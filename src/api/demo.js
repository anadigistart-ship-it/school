// DEMO MODE ONLY. In-browser mock backend so the UI can be explored without Google Sheets.
// Never used when VITE_APP_MODE=production.
const ACCOUNTS = [
  { user_id: 'USR-0001', username: 'admin', password: 'demo1234', full_name: 'Demo Administrator', email: 'admin@demo.school', role: 'admin' },
  { user_id: 'USR-0002', username: 'teacher', password: 'demo1234', full_name: 'Demo Teacher', email: 'teacher@demo.school', role: 'teacher', teacher_id: 'TCH-0001' },
  { user_id: 'USR-0003', username: 'student', password: 'demo1234', full_name: 'Demo Student', email: 'student@demo.school', role: 'student', student_id: 'STU-0001' },
]
const sessions = new Map()
const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms))
const publicUser = ({ password, ...u }) => u
const fail = (code, message) => ({ ok: false, error: { code, message } })

export async function demoCall(action, payload = {}, token) {
  await delay()
  const key = 'ssa.demo.accounts'
  let accounts = ACCOUNTS
  try { accounts = JSON.parse(localStorage.getItem(key)) || ACCOUNTS } catch { /* ignore */ }

  if (action === 'login') {
    const id = String(payload.identifier || '').trim().toLowerCase()
    const acc = accounts.find((a) => [a.username, a.email, a.student_id]
      .filter(Boolean).some((v) => v.toLowerCase() === id))
    if (!acc || acc.password !== payload.password) return fail('INVALID_CREDENTIALS', 'Incorrect username or password.')
    const t = 'demo-' + Math.random().toString(36).slice(2)
    sessions.set(t, acc.user_id)
    localStorage.setItem('ssa.demo.sessions', JSON.stringify([...sessions]))
    return { ok: true, data: { token: t, user: publicUser(acc) } }
  }

  // restore sessions after page reload
  if (!sessions.size) {
    try { JSON.parse(localStorage.getItem('ssa.demo.sessions') || '[]').forEach(([k, v]) => sessions.set(k, v)) } catch { /* ignore */ }
  }
  const uid = sessions.get(token)
  const acc = accounts.find((a) => a.user_id === uid)
  if (!acc) return fail('UNAUTHENTICATED', 'Your session has expired. Please sign in again.')

  switch (action) {
    case 'me': return { ok: true, data: { user: publicUser(acc) } }
    case 'logout':
      sessions.delete(token)
      localStorage.setItem('ssa.demo.sessions', JSON.stringify([...sessions]))
      return { ok: true, data: {} }
    case 'changePassword': {
      if (acc.password !== payload.currentPassword) return fail('INVALID_CREDENTIALS', 'Current password is incorrect.')
      if (!payload.newPassword || payload.newPassword.length < 8) return fail('VALIDATION', 'New password must be at least 8 characters.')
      acc.password = payload.newPassword
      localStorage.setItem(key, JSON.stringify(accounts))
      return { ok: true, data: {} }
    }
    case 'requestPasswordReset': return { ok: true, data: {} }
    default: return fail('NOT_FOUND', 'Unknown action.')
  }
}

export async function demoPublic(action) {
  await delay(400)
  if (action === 'requestPasswordReset') return { ok: true, data: {} }
  return fail('NOT_FOUND', 'Unknown action.')
}
