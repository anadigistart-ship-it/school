/**
 * Smart School Attendance: Google Apps Script API (Phase 1-2: auth + sheet setup)
 *
 * Deploy as Web App: Execute as "Me", access "Anyone".
 * The sheet itself stays private; every request is rejected unless it carries a valid session token.
 * All sheet access goes through the Repo object, so the storage layer can be swapped later.
 */

// ========================= CONFIG =========================
var CONFIG = {
  SESSION_HOURS: 8,
  MAX_FAILED_LOGINS: 5,
  LOCKOUT_SECONDS: 15 * 60,
  HASH_ITERATIONS: 1000,
  MIN_PASSWORD_LENGTH: 8
};

var SCHEMA = {
  Users: ['user_id', 'username', 'password_hash', 'full_name', 'email', 'role', 'student_id', 'teacher_id', 'account_status', 'created_at'],
  Students: ['student_id', 'full_name', 'gender', 'class_id', 'date_of_birth', 'address', 'parent_name', 'parent_phone', 'barcode_value', 'photo_url', 'status'],
  Teachers: ['teacher_id', 'full_name', 'email', 'phone', 'assigned_classes', 'status'],
  Classes: ['class_id', 'class_name', 'grade_level', 'homeroom_teacher_id', 'academic_year'],
  Attendance: ['attendance_id', 'student_id', 'student_name', 'class_id', 'attendance_date', 'check_in_time', 'attendance_status', 'recorded_by', 'attendance_source', 'notes', 'created_at'],
  School_Settings: ['school_name', 'school_logo', 'school_address', 'school_timezone', 'school_start_time', 'late_threshold', 'academic_year'],
  Activity_Logs: ['log_id', 'user_id', 'action', 'entity_type', 'entity_id', 'timestamp'],
  Sessions: ['token_hash', 'user_id', 'created_at', 'expires_at']
};

var ROLES = ['admin', 'teacher', 'student'];

// ========================= HTTP ENTRY =========================
function doGet() {
  return json_({ ok: true, data: { service: 'school-attendance-api', status: 'up' } });
}

function doPost(e) {
  try {
    var req = parseRequest_(e);
    var handler = ROUTES[req.action];
    if (!handler) throw new ApiError_('NOT_FOUND', 'Unknown action.');

    var ctx = { action: req.action, payload: req.payload, user: null, tokenHash: null };
    if (!handler.public) {
      var s = requireSession_(req.token);
      ctx.user = s.user;
      ctx.tokenHash = s.tokenHash;
    }
    if (handler.roles && handler.roles.indexOf(ctx.user.role) === -1) {
      throw new ApiError_('FORBIDDEN', 'You do not have permission to do that.');
    }
    return json_({ ok: true, data: handler.run(ctx) });
  } catch (err) {
    if (err instanceof ApiError_) return json_({ ok: false, error: { code: err.code, message: err.message } });
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' } });
  }
}

var ROUTES = {
  login: { public: true, run: actionLogin_ },
  requestPasswordReset: { public: true, run: actionRequestReset_ },
  me: { run: function (ctx) { return { user: publicUser_(ctx.user) }; } },
  logout: { run: actionLogout_ },
  changePassword: { run: actionChangePassword_ }
};

// ========================= ACTIONS =========================
function actionLogin_(ctx) {
  var identifier = str_(ctx.payload.identifier, 120).toLowerCase();
  var password = String(ctx.payload.password || '');
  if (!identifier || !password) throw new ApiError_('VALIDATION', 'Enter your username and password.');

  var throttleKey = 'login_fail_' + sha256Hex_(identifier).slice(0, 32);
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get(throttleKey) || 0);
  if (fails >= CONFIG.MAX_FAILED_LOGINS) {
    throw new ApiError_('RATE_LIMITED', 'Too many failed attempts. Try again in 15 minutes.');
  }

  var user = findUserByIdentifier_(identifier);
  // Always run a hash so response time does not reveal whether the account exists.
  var ok = verifyPassword_(password, user ? user.password_hash : makePasswordHash_('dummy-password'));

  if (!user || !ok || String(user.account_status).toLowerCase() !== 'active') {
    cache.put(throttleKey, String(fails + 1), CONFIG.LOCKOUT_SECONDS);
    if (user && ok) throw new ApiError_('INVALID_CREDENTIALS', 'This account is not active. Contact the school office.');
    throw new ApiError_('INVALID_CREDENTIALS', 'Incorrect username or password.');
  }
  cache.remove(throttleKey);

  var token = newToken_();
  Repo.insert('Sessions', {
    token_hash: sha256Hex_(token),
    user_id: user.user_id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CONFIG.SESSION_HOURS * 3600 * 1000).toISOString()
  });
  purgeExpiredSessions_();
  logActivity_(user.user_id, 'login', 'User', user.user_id);
  return { token: token, user: publicUser_(user) };
}

function actionLogout_(ctx) {
  Repo.removeWhere('Sessions', function (r) { return r.token_hash === ctx.tokenHash; });
  logActivity_(ctx.user.user_id, 'logout', 'User', ctx.user.user_id);
  return {};
}

function actionChangePassword_(ctx) {
  var current = String(ctx.payload.currentPassword || '');
  var next = String(ctx.payload.newPassword || '');
  validatePasswordStrength_(next);
  if (!verifyPassword_(current, ctx.user.password_hash)) {
    throw new ApiError_('INVALID_CREDENTIALS', 'Current password is incorrect.');
  }
  if (current === next) throw new ApiError_('VALIDATION', 'New password must differ from the current one.');

  Repo.update('Users', 'user_id', ctx.user.user_id, { password_hash: makePasswordHash_(next) });
  // Revoke every session for this user, including the current one.
  Repo.removeWhere('Sessions', function (r) { return r.user_id === ctx.user.user_id; });
  logActivity_(ctx.user.user_id, 'change_password', 'User', ctx.user.user_id);
  return {};
}

function actionRequestReset_(ctx) {
  var identifier = str_(ctx.payload.identifier, 120).toLowerCase();
  if (!identifier) throw new ApiError_('VALIDATION', 'Enter your username, email, or student ID.');
  var user = findUserByIdentifier_(identifier);
  // Same response either way so account existence is not revealed. Admins see requests in the log.
  if (user) logActivity_(user.user_id, 'password_reset_requested', 'User', user.user_id);
  return {};
}

// ========================= SESSIONS =========================
function requireSession_(token) {
  token = String(token || '');
  if (token.length < 32) throw new ApiError_('UNAUTHENTICATED', 'Please sign in.');
  var hash = sha256Hex_(token);
  var session = Repo.find('Sessions', 'token_hash', hash);
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    if (session) Repo.removeWhere('Sessions', function (r) { return r.token_hash === hash; });
    throw new ApiError_('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }
  var user = Repo.find('Users', 'user_id', session.user_id);
  if (!user || String(user.account_status).toLowerCase() !== 'active') {
    throw new ApiError_('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }
  return { user: user, tokenHash: hash };
}

function purgeExpiredSessions_() {
  var now = Date.now();
  Repo.removeWhere('Sessions', function (r) { return new Date(r.expires_at).getTime() < now; });
}

function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

// ========================= USERS =========================
function findUserByIdentifier_(identifier) {
  var users = Repo.all('Users');
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if ([u.username, u.email, u.student_id].some(function (v) { return v && String(v).toLowerCase() === identifier; })) return u;
  }
  return null;
}

function publicUser_(u) {
  var out = {
    user_id: u.user_id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    role: u.role
  };
  if (u.student_id) out.student_id = u.student_id;
  if (u.teacher_id) out.teacher_id = u.teacher_id;
  return out;
}

function validatePasswordStrength_(pw) {
  if (pw.length < CONFIG.MIN_PASSWORD_LENGTH) throw new ApiError_('VALIDATION', 'New password must be at least ' + CONFIG.MIN_PASSWORD_LENGTH + ' characters.');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new ApiError_('VALIDATION', 'New password must include a letter and a number.');
}

// ========================= PASSWORDS =========================
// Format: iterations$salt$hash  (iterated, salted SHA-256; Apps Script has no bcrypt/argon2)
function makePasswordHash_(password) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return CONFIG.HASH_ITERATIONS + '$' + salt + '$' + derive_(password, salt, CONFIG.HASH_ITERATIONS);
}

function verifyPassword_(password, stored) {
  var parts = String(stored || '').split('$');
  if (parts.length !== 3) return false;
  var computed = derive_(password, parts[1], Number(parts[0]));
  return constantTimeEquals_(computed, parts[2]);
}

function derive_(password, salt, iterations) {
  var h = sha256Hex_(salt + ':' + password);
  for (var i = 1; i < iterations; i++) h = sha256Hex_(h + salt + password);
  return h;
}

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ========================= AUDIT LOG =========================
function logActivity_(userId, action, entityType, entityId) {
  try {
    Repo.insert('Activity_Logs', {
      log_id: Repo.newId('LOG'),
      user_id: userId,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      timestamp: new Date().toISOString()
    });
  } catch (e) { console.error('log failed', e); }
}

// ========================= REPOSITORY (storage layer) =========================
// Swap this object to move to PostgreSQL or another database. Rows are addressed by stable IDs,
// never by row number.
var Repo = {
  sheet: function (name) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Missing sheet: ' + name + '. Run setupSheets().');
    return sh;
  },
  all: function (name) {
    var sh = Repo.sheet(name);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var cols = SCHEMA[name];
    var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
    return values.map(function (row) {
      var o = {};
      cols.forEach(function (c, i) { o[c] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
      return o;
    });
  },
  find: function (name, field, value) {
    var rows = Repo.all(name);
    for (var i = 0; i < rows.length; i++) if (String(rows[i][field]) === String(value)) return rows[i];
    return null;
  },
  insert: function (name, obj) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var cols = SCHEMA[name];
      // Text format keeps IDs/ISO dates from being auto-converted by Sheets.
      var sh = Repo.sheet(name);
      var row = sh.getLastRow() + 1;
      sh.getRange(row, 1, 1, cols.length).setNumberFormat('@');
      sh.getRange(row, 1, 1, cols.length).setValues([cols.map(function (c) { return obj[c] === undefined ? '' : obj[c]; })]);
      return obj;
    } finally { lock.releaseLock(); }
  },
  update: function (name, keyField, keyValue, patch) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = Repo.sheet(name);
      var cols = SCHEMA[name];
      var keyCol = cols.indexOf(keyField) + 1;
      var last = sh.getLastRow();
      if (last < 2) throw new ApiError_('NOT_FOUND', 'Record not found.');
      var keys = sh.getRange(2, keyCol, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === String(keyValue)) {
          Object.keys(patch).forEach(function (f) {
            var c = cols.indexOf(f);
            if (c >= 0) sh.getRange(i + 2, c + 1).setValue(patch[f]);
          });
          return true;
        }
      }
      throw new ApiError_('NOT_FOUND', 'Record not found.');
    } finally { lock.releaseLock(); }
  },
  removeWhere: function (name, predicate) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = Repo.sheet(name);
      var rows = Repo.all(name);
      // Delete bottom-up so row indexes stay valid.
      for (var i = rows.length - 1; i >= 0; i--) if (predicate(rows[i])) sh.deleteRow(i + 2);
    } finally { lock.releaseLock(); }
  },
  newId: function (prefix) {
    return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  }
};

// ========================= SETUP (run from the editor) =========================
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var cols = SCHEMA[name];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#12204a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  // Sessions hold token hashes; hide the tab to reduce accidental exposure.
  var sessions = ss.getSheetByName('Sessions');
  if (sessions) sessions.hideSheet();

  var settings = ss.getSheetByName('School_Settings');
  if (settings.getLastRow() < 2) {
    Repo.insert('School_Settings', {
      school_name: 'SDN 96 SUMBER AGUNG', school_logo: '', school_address: '',
      school_timezone: Session.getScriptTimeZone(), school_start_time: '07:30', late_threshold: '07:45', academic_year: ''
    });
  }
  console.log('Sheets ready. Next: createInitialAdmin() for production or seedDevData() for development.');
}

/** Production: run once from the editor with your own values, then clear the arguments. */
function createInitialAdmin(username, fullName, password) {
  if (!username || !fullName || !password) throw new Error('Usage: createInitialAdmin("username", "Full Name", "password")');
  validatePasswordStrength_(password);
  if (findUserByIdentifier_(String(username).toLowerCase())) throw new Error('Username already exists.');
  var id = Repo.newId('USR');
  Repo.insert('Users', {
    user_id: id, username: username, password_hash: makePasswordHash_(password), full_name: fullName,
    email: '', role: 'admin', student_id: '', teacher_id: '', account_status: 'active', created_at: new Date().toISOString()
  });
  logActivity_(id, 'create_initial_admin', 'User', id);
  console.log('Admin created: ' + username);
}

/** DEVELOPMENT ONLY. Creates well-known demo accounts. Never run in production. */
function seedDevData() {
  var demo = [
    ['admin', 'Demo Administrator', 'admin', '', ''],
    ['teacher', 'Demo Teacher', 'teacher', '', 'TCH-0001'],
    ['student', 'Demo Student', 'student', 'STU-0001', '']
  ];
  demo.forEach(function (d) {
    if (findUserByIdentifier_(d[0])) return;
    Repo.insert('Users', {
      user_id: Repo.newId('USR'), username: d[0], password_hash: makePasswordHash_('demo1234'), full_name: d[1],
      email: d[0] + '@demo.school', role: d[2], student_id: d[3], teacher_id: d[4], account_status: 'active', created_at: new Date().toISOString()
    });
  });
  console.log('Dev users created (password demo1234). Remove them before going live.');
}

// ========================= HELPERS =========================
function ApiError_(code, message) { this.code = code; this.message = message; }
ApiError_.prototype = Object.create(Error.prototype);

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new ApiError_('BAD_REQUEST', 'Empty request.');
  if (e.postData.contents.length > 100000) throw new ApiError_('BAD_REQUEST', 'Request too large.');
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { throw new ApiError_('BAD_REQUEST', 'Invalid JSON.'); }
  if (!body || typeof body.action !== 'string') throw new ApiError_('BAD_REQUEST', 'Missing action.');
  return { action: body.action, token: body.token || null, payload: body.payload && typeof body.payload === 'object' ? body.payload : {} };
}

function str_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 255); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
