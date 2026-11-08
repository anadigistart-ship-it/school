<script setup>
/**
 * Pengguna & Peran (khusus admin)
 * Backend (entity 'users'): list / create / update / remove, resetPassword, options.
 *  - list   { entity, search, filters:{role,account_status}, sort, dir, page, pageSize }
 *  - create { entity, data:{ username, full_name, email, role, student_id|teacher_id, account_status, password } }
 *  - update { entity, id, data }   (tanpa password)
 *  - remove { entity, id }
 *  - resetPassword { user_id, newPassword }
 *  - options -> { teachers:[{teacher_id,full_name}], students:[{student_id,full_name,class_id}], classes }
 */
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/api/client.js' // SESUAIKAN path
import { useAuthStore } from '@/stores/auth' // SESUAIKAN store (butuh token & user.user_id)

const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)
const meId = computed(() => auth.user?.user_id)

const ROLES = [
  { value: 'admin', label: 'Admin', hint: 'Akses penuh ke seluruh data dan pengaturan.' },
  { value: 'teacher', label: 'Guru', hint: 'Mengelola absensi & laporan kelas yang diampu.' },
  { value: 'student', label: 'Siswa', hint: 'Akun milik satu siswa.' },
]
const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label || r

// ---------- Daftar ----------
const items = ref([])
const meta = reactive({ total: 0, page: 1, pages: 1, pageSize: 10 })
const loading = ref(false)
const error = ref('')
const search = ref('')
const filterRole = ref('')
const filterStatus = ref('')
const sortKey = ref('full_name')
const sortDir = ref('asc')

let reqId = 0
async function load(page = meta.page) {
  const id = ++reqId
  loading.value = true
  error.value = ''
  try {
    const res = await callApi('list', {
      entity: 'users',
      search: search.value,
      filters: { role: filterRole.value, account_status: filterStatus.value },
      sort: sortKey.value,
      dir: sortDir.value,
      page,
      pageSize: meta.pageSize,
    })
    if (id !== reqId) return
    items.value = res.items
    Object.assign(meta, { total: res.total, page: res.page, pages: res.pages })
  } catch (e) {
    if (id !== reqId) return
    error.value = e?.message || 'Gagal memuat pengguna.'
  } finally {
    if (id === reqId) loading.value = false
  }
}

let t
watch(search, () => { clearTimeout(t); t = setTimeout(() => load(1), 300) })
watch([filterRole, filterStatus], () => load(1))
onBeforeUnmount(() => clearTimeout(t))

function sortBy(k) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = 'asc' }
  load(1)
}
const arrow = (k) => (sortKey.value === k ? (sortDir.value === 'asc' ? ' ▲' : ' ▼') : '')

// ---------- Opsi (guru & siswa untuk tautan akun) ----------
const teachers = ref([])
const students = ref([])
const teacherName = computed(() => Object.fromEntries(teachers.value.map((x) => [x.teacher_id, x.full_name])))
const studentName = computed(() => Object.fromEntries(students.value.map((x) => [x.student_id, x.full_name])))
const classLabel = ref({})

async function loadOptions() {
  try {
    const o = await callApi('options', {})
    teachers.value = o.teachers || []
    students.value = o.students || []
    classLabel.value = Object.fromEntries((o.classes || []).map((c) => [c.class_id, c.class_name]))
  } catch { /* tautan tetap tampil sebagai ID */ }
}
function linkedLabel(u) {
  if (u.role === 'teacher' && u.teacher_id) return teacherName.value[u.teacher_id] || u.teacher_id
  if (u.role === 'student' && u.student_id) return studentName.value[u.student_id] || u.student_id
  return '–'
}

// ---------- Toast ----------
const toast = ref('')
let toastT
function notify(msg) { toast.value = msg; clearTimeout(toastT); toastT = setTimeout(() => (toast.value = ''), 3500) }

// ---------- Form tambah / ubah ----------
const form = reactive({ open: false, id: null, saving: false, error: '', showPw: false, studentQ: '',
  data: { username: '', full_name: '', email: '', role: 'teacher', student_id: '', teacher_id: '', account_status: 'active', password: '' } })
const isEdit = computed(() => !!form.id)
const isSelf = computed(() => isEdit.value && form.id === meId.value)

function openCreate() {
  Object.assign(form, { open: true, id: null, saving: false, error: '', showPw: false, studentQ: '' })
  form.data = { username: '', full_name: '', email: '', role: 'teacher', student_id: '', teacher_id: '', account_status: 'active', password: '' }
}
function openEdit(u) {
  Object.assign(form, { open: true, id: u.user_id, saving: false, error: '', showPw: false, studentQ: '' })
  form.data = { username: u.username, full_name: u.full_name, email: u.email || '', role: u.role,
    student_id: u.student_id || '', teacher_id: u.teacher_id || '', account_status: u.account_status || 'active', password: '' }
}
const filteredStudents = computed(() => {
  const q = form.studentQ.trim().toLowerCase()
  const list = q ? students.value.filter((s) => `${s.full_name} ${s.student_id}`.toLowerCase().includes(q)) : students.value
  return list.slice(0, 100)
})

function pwProblem(pw) {
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter.'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Kata sandi harus mengandung huruf dan angka.'
  return ''
}
function genPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const num = '23456789'
  const pick = (s, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => s[v % s.length]).join('')
  return pick(abc, 6) + pick(num, 3) + pick(abc, 1)
}
function fillPassword() { form.data.password = genPassword(); form.showPw = true }

async function save() {
  const d = form.data
  form.error = ''
  if (!d.username.trim() || !d.full_name.trim()) { form.error = 'Nama pengguna dan nama lengkap wajib diisi.'; return }
  if (d.role === 'teacher' && !d.teacher_id) { form.error = 'Pilih guru untuk akun ini.'; return }
  if (d.role === 'student' && !d.student_id) { form.error = 'Pilih siswa untuk akun ini.'; return }
  if (!isEdit.value) { const p = pwProblem(d.password); if (p) { form.error = p; return } }

  const data = { username: d.username.trim(), full_name: d.full_name.trim(), email: d.email.trim(),
    role: d.role, account_status: d.account_status,
    student_id: d.role === 'student' ? d.student_id : '', teacher_id: d.role === 'teacher' ? d.teacher_id : '' }
  if (!isEdit.value) data.password = d.password

  form.saving = true
  try {
    if (isEdit.value) await callApi('update', { entity: 'users', id: form.id, data })
    else await callApi('create', { entity: 'users', data })
    form.open = false
    notify(isEdit.value ? 'Pengguna diperbarui.' : 'Pengguna ditambahkan.')
    load(isEdit.value ? meta.page : 1)
  } catch (e) {
    form.error = e?.message || 'Gagal menyimpan.'
  } finally {
    form.saving = false
  }
}

// ---------- Reset kata sandi ----------
const reset = reactive({ open: false, user: null, pw: '', show: true, saving: false, error: '' })
function openReset(u) { Object.assign(reset, { open: true, user: u, pw: genPassword(), show: true, saving: false, error: '' }) }
async function doReset() {
  const p = pwProblem(reset.pw)
  if (p) { reset.error = p; return }
  reset.saving = true; reset.error = ''
  try {
    await callApi('resetPassword', { user_id: reset.user.user_id, newPassword: reset.pw })
    reset.open = false
    notify(`Kata sandi ${reset.user.username} diganti. Sesi aktifnya diakhiri.`)
  } catch (e) {
    reset.error = e?.message || 'Gagal mengganti kata sandi.'
  } finally {
    reset.saving = false
  }
}
async function copyPw() {
  try { await navigator.clipboard.writeText(reset.pw); notify('Kata sandi disalin.') } catch { /* abaikan */ }
}

// ---------- Hapus ----------
const del = reactive({ open: false, user: null, saving: false, error: '' })
function openDelete(u) { Object.assign(del, { open: true, user: u, saving: false, error: '' }) }
async function doDelete() {
  del.saving = true; del.error = ''
  try {
    await callApi('remove', { entity: 'users', id: del.user.user_id })
    del.open = false
    notify('Pengguna dihapus.')
    load(items.value.length === 1 && meta.page > 1 ? meta.page - 1 : meta.page)
  } catch (e) {
    del.error = e?.message || 'Gagal menghapus.'
  } finally {
    del.saving = false
  }
}

onMounted(() => { loadOptions(); load(1) })
</script>

<template>
  <section class="usr">
    <header class="head">
      <div>
        <h1>Pengguna &amp; Peran</h1>
        <p class="muted">Kelola akun masuk untuk admin, guru, dan siswa.</p>
      </div>
      <button class="btn primary" @click="openCreate">+ Tambah pengguna</button>
    </header>

    <div class="roles">
      <div v-for="r in ROLES" :key="r.value" class="role">
        <b>{{ r.label }}</b><span>{{ r.hint }}</span>
      </div>
    </div>

    <div class="filters">
      <input v-model="search" type="search" placeholder="Cari nama, nama pengguna, atau email…" class="grow" />
      <select v-model="filterRole">
        <option value="">Semua peran</option>
        <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
      </select>
      <select v-model="filterStatus">
        <option value="">Semua status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
      </select>
    </div>

    <p v-if="error" class="alert" role="alert">{{ error }} <button class="link" @click="load(meta.page)">Coba lagi</button></p>

    <div class="scroll" :class="{ dim: loading }">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('full_name')">Nama{{ arrow('full_name') }}</th>
            <th @click="sortBy('username')">Nama pengguna{{ arrow('username') }}</th>
            <th @click="sortBy('role')">Peran{{ arrow('role') }}</th>
            <th>Terhubung ke</th>
            <th @click="sortBy('account_status')">Status{{ arrow('account_status') }}</th>
            <th class="end">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in items" :key="u.user_id">
            <td>{{ u.full_name }}<small>{{ u.email || '—' }}</small></td>
            <td><code>{{ u.username }}</code></td>
            <td><span class="tag" :class="u.role">{{ roleLabel(u.role) }}</span></td>
            <td>{{ linkedLabel(u) }}</td>
            <td>
              <span class="dot" :class="u.account_status === 'active' ? 'on' : 'off'" />
              {{ u.account_status === 'active' ? 'Aktif' : 'Nonaktif' }}
            </td>
            <td class="end">
              <button class="btn sm" @click="openEdit(u)">Ubah</button>
              <button class="btn sm" @click="openReset(u)">Reset sandi</button>
              <button class="btn sm danger" :disabled="u.user_id === meId" :title="u.user_id === meId ? 'Tidak bisa menghapus akun sendiri' : ''" @click="openDelete(u)">Hapus</button>
            </td>
          </tr>
          <tr v-if="!items.length && !loading"><td colspan="6" class="empty">Tidak ada pengguna.</td></tr>
          <tr v-if="!items.length && loading"><td colspan="6" class="empty">Memuat…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="muted">{{ meta.total }} pengguna</span>
      <div>
        <button class="btn sm" :disabled="meta.page <= 1" @click="load(meta.page - 1)">‹</button>
        <span class="pg">{{ meta.page }} / {{ meta.pages }}</span>
        <button class="btn sm" :disabled="meta.page >= meta.pages" @click="load(meta.page + 1)">›</button>
      </div>
    </div>

    <!-- Form tambah/ubah -->
    <div v-if="form.open" class="overlay" @mousedown.self="form.open = false">
      <form class="modal" @submit.prevent="save">
        <h2>{{ isEdit ? 'Ubah pengguna' : 'Tambah pengguna' }}</h2>

        <label>Nama lengkap <input v-model="form.data.full_name" maxlength="100" required /></label>
        <div class="two">
          <label>Nama pengguna <input v-model="form.data.username" maxlength="30" autocomplete="off" required /></label>
          <label>Email <input v-model="form.data.email" type="email" /></label>
        </div>
        <p class="field-hint">Nama pengguna 3–30 karakter: huruf, angka, titik, garis bawah, atau strip.</p>

        <div class="two">
          <label>Peran
            <select v-model="form.data.role" :disabled="isSelf">
              <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </label>
          <label>Status akun
            <select v-model="form.data.account_status" :disabled="isSelf">
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </label>
        </div>
        <p v-if="isSelf" class="field-hint">Anda tidak dapat mengubah peran atau status akun Anda sendiri.</p>

        <label v-if="form.data.role === 'teacher'">Guru
          <select v-model="form.data.teacher_id" required>
            <option value="">— pilih guru —</option>
            <option v-for="t in teachers" :key="t.teacher_id" :value="t.teacher_id">{{ t.full_name }} ({{ t.teacher_id }})</option>
          </select>
        </label>

        <div v-if="form.data.role === 'student'" class="stack">
          <label>Siswa
            <input v-model="form.studentQ" type="search" placeholder="Cari nama atau NIS siswa…" />
          </label>
          <select v-model="form.data.student_id" size="5" required>
            <option v-for="s in filteredStudents" :key="s.student_id" :value="s.student_id">
              {{ s.full_name }} — {{ s.student_id }}{{ classLabel[s.class_id] ? ' · ' + classLabel[s.class_id] : '' }}
            </option>
          </select>
          <p v-if="form.data.student_id" class="field-hint">Terpilih: {{ studentName[form.data.student_id] || form.data.student_id }}</p>
        </div>

        <div v-if="!isEdit" class="stack">
          <label>Kata sandi awal
            <div class="pw">
              <input v-model="form.data.password" :type="form.showPw ? 'text' : 'password'" autocomplete="new-password" required />
              <button type="button" class="btn sm" @click="form.showPw = !form.showPw">{{ form.showPw ? 'Sembunyikan' : 'Tampilkan' }}</button>
              <button type="button" class="btn sm" @click="fillPassword">Buat acak</button>
            </div>
          </label>
          <p class="field-hint">Minimal 8 karakter, mengandung huruf dan angka.</p>
        </div>

        <p v-if="form.error" class="alert" role="alert">{{ form.error }}</p>
        <div class="foot">
          <button type="button" class="btn" @click="form.open = false">Batal</button>
          <button class="btn primary" :disabled="form.saving">{{ form.saving ? 'Menyimpan…' : 'Simpan' }}</button>
        </div>
      </form>
    </div>

    <!-- Reset sandi -->
    <div v-if="reset.open" class="overlay" @mousedown.self="reset.open = false">
      <form class="modal" @submit.prevent="doReset">
        <h2>Reset kata sandi</h2>
        <p class="muted">Akun: <b>{{ reset.user.full_name }}</b> (<code>{{ reset.user.username }}</code>). Semua sesi aktifnya akan diakhiri.</p>
        <label>Kata sandi baru
          <div class="pw">
            <input v-model="reset.pw" :type="reset.show ? 'text' : 'password'" autocomplete="new-password" required />
            <button type="button" class="btn sm" @click="reset.pw = genPassword()">Acak ulang</button>
            <button type="button" class="btn sm" @click="copyPw">Salin</button>
          </div>
        </label>
        <p class="field-hint">Sampaikan kata sandi ini ke pemilik akun secara langsung dan minta segera menggantinya.</p>
        <p v-if="reset.error" class="alert" role="alert">{{ reset.error }}</p>
        <div class="foot">
          <button type="button" class="btn" @click="reset.open = false">Batal</button>
          <button class="btn primary" :disabled="reset.saving">{{ reset.saving ? 'Menyimpan…' : 'Ganti kata sandi' }}</button>
        </div>
      </form>
    </div>

    <!-- Hapus -->
    <div v-if="del.open" class="overlay" @mousedown.self="del.open = false">
      <div class="modal">
        <h2>Hapus pengguna?</h2>
        <p>Akun <b>{{ del.user.full_name }}</b> (<code>{{ del.user.username }}</code>) akan dihapus permanen dan tidak bisa masuk lagi. Data siswa/guru yang terhubung tidak ikut terhapus.</p>
        <p v-if="del.error" class="alert" role="alert">{{ del.error }}</p>
        <div class="foot">
          <button class="btn" @click="del.open = false">Batal</button>
          <button class="btn danger solid" :disabled="del.saving" @click="doDelete">{{ del.saving ? 'Menghapus…' : 'Ya, hapus' }}</button>
        </div>
      </div>
    </div>

    <transition name="fade"><div v-if="toast" class="toast" role="status">{{ toast }}</div></transition>
  </section>
</template>

<style scoped>
.usr { --line: #e5e7eb; --muted: #6b7280; max-width: 1100px; margin: 0 auto; padding: 16px; color: #111827; }
.head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 0 0 12px; }
.muted { color: var(--muted); margin: 0; font-size: .85rem; }
code { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; font-size: .8rem; }

.roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 16px 0; }
.role { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.role span { font-size: .78rem; color: var(--muted); }

.btn, input, select { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 8px 12px; font: inherit; }
.btn { cursor: pointer; }
.btn:hover:not(:disabled) { background: #f9fafb; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.sm { padding: 4px 10px; font-size: .8rem; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #1d4ed8; }
.btn.danger { color: #b91c1c; border-color: #fecaca; }
.btn.danger.solid { background: #dc2626; border-color: #dc2626; color: #fff; }
.btn.danger.solid:hover:not(:disabled) { background: #b91c1c; }
.link { background: none; border: 0; color: #2563eb; text-decoration: underline; cursor: pointer; font: inherit; }

.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.grow { flex: 1; min-width: 200px; }

.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; transition: opacity .15s; }
.scroll.dim { opacity: .55; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th, td { padding: 9px 10px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { background: #f9fafb; font-size: .72rem; text-transform: uppercase; letter-spacing: .02em; color: var(--muted); cursor: pointer; user-select: none; }
th.end, td.end { text-align: right; cursor: default; }
td.end { display: flex; gap: 6px; justify-content: flex-end; }
tbody tr:hover { background: #f9fafb; }
tr:last-child td { border-bottom: 0; }
td small { display: block; color: var(--muted); font-size: .72rem; }
.empty { text-align: center; color: var(--muted); padding: 24px; }

.tag { padding: 2px 9px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
.tag.admin { background: #fee2e2; color: #991b1b; }
.tag.teacher { background: #dbeafe; color: #1e40af; }
.tag.student { background: #dcfce7; color: #166534; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dot.on { background: #16a34a; } .dot.off { background: #9ca3af; }

.pager { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
.pg { margin: 0 8px; font-size: .85rem; }

.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: .85rem; }

.overlay { position: fixed; inset: 0; background: rgba(17, 24, 39, .45); display: grid; place-items: center; padding: 16px; z-index: 50; overflow-y: auto; }
.modal { background: #fff; border-radius: 14px; padding: 20px; width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 10px; }
.modal label { display: flex; flex-direction: column; gap: 4px; font-size: .78rem; color: var(--muted); }
.modal input, .modal select { color: #111827; width: 100%; box-sizing: border-box; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stack { display: flex; flex-direction: column; gap: 6px; }
.pw { display: flex; gap: 6px; }
.pw input { flex: 1; min-width: 0; }
.field-hint { margin: -4px 0 0; font-size: .72rem; color: var(--muted); }
.foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #111827; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: .85rem; z-index: 60; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
</style>
