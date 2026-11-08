<script setup>
/**
 * Profil Saya (semua peran)
 * Backend: me {} -> { user }, changePassword { currentPassword, newPassword }, logout {},
 *          options {} (hanya guru: daftar kelas yang diampu).
 *
 * Penting: changePassword di backend mengakhiri SEMUA sesi akun ini (termasuk yang sedang dipakai),
 * jadi setelah berhasil pengguna harus masuk lagi -> komponen mengirim event `signed-out`.
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '@/api/client.js' // SESUAIKAN path
import { useAuthStore } from '@/stores/auth' // SESUAIKAN store (token, user, dan fungsi mengosongkan sesi)

const emit = defineEmits(['signed-out']) // router: arahkan ke halaman login

const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)

const ROLE = {
  admin: { label: 'Admin', desc: 'Akses penuh ke data dan pengaturan sekolah.' },
  teacher: { label: 'Guru', desc: 'Mengelola absensi dan laporan kelas yang diampu.' },
  student: { label: 'Siswa', desc: 'Akun siswa.' },
}

// ---------- Profil ----------
const user = ref(auth.user || null)
const classes = ref([])
const loading = ref(true)
const loadError = ref('')

const initials = computed(() =>
  (user.value?.full_name || user.value?.username || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
)
const role = computed(() => ROLE[user.value?.role] || { label: user.value?.role || '-', desc: '' })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await callApi('me', {})
    user.value = res.user
    if (res.user.role === 'teacher') {
      try { classes.value = (await callApi('options', {})).classes || [] } catch { /* opsional */ }
    }
  } catch (e) {
    if (!user.value) loadError.value = e?.message || 'Gagal memuat profil.'
  } finally {
    loading.value = false
  }
}

// ---------- Sesi ----------
async function clearLocalSession() {
  try { await auth.logout?.() } catch { /* sesi mungkin sudah dihapus server */ }
  emit('signed-out')
}

const signingOut = ref(false)
async function signOut() {
  signingOut.value = true
  try { await callApi('logout', {}) } catch { /* tetap keluar secara lokal */ }
  await clearLocalSession()
}

// ---------- Ganti kata sandi ----------
const pw = reactive({ current: '', next: '', confirm: '', show: false, saving: false, error: '', done: false })

const rules = computed(() => [
  { ok: pw.next.length >= 8, text: 'Minimal 8 karakter' },
  { ok: /[A-Za-z]/.test(pw.next) && /\d/.test(pw.next), text: 'Mengandung huruf dan angka' },
  { ok: !!pw.next && pw.next !== pw.current, text: 'Berbeda dari kata sandi saat ini' },
  { ok: !!pw.next && pw.next === pw.confirm, text: 'Konfirmasi cocok' },
])
const canSubmit = computed(() => !!pw.current && rules.value.every((r) => r.ok) && !pw.saving && !pw.done)

async function changePassword() {
  if (!canSubmit.value) return
  pw.saving = true
  pw.error = ''
  try {
    await callApi('changePassword', { currentPassword: pw.current, newPassword: pw.next })
    pw.done = true
    pw.current = pw.next = pw.confirm = ''
    setTimeout(clearLocalSession, 2000)
  } catch (e) {
    pw.error = e?.message || 'Gagal mengganti kata sandi.'
  } finally {
    pw.saving = false
  }
}

onMounted(load)
</script>

<template>
  <section class="prof">
    <header class="head">
      <h1>Profil Saya</h1>
      <p class="muted">Informasi akun dan keamanan.</p>
    </header>

    <p v-if="loading && !user" class="empty">Memuat profil…</p>
    <p v-else-if="loadError" class="alert" role="alert">{{ loadError }} <button class="link" @click="load">Coba lagi</button></p>

    <template v-else-if="user">
      <div class="card who">
        <div class="avatar" aria-hidden="true">{{ initials }}</div>
        <div class="who-text">
          <h2>{{ user.full_name }}</h2>
          <span class="tag" :class="user.role">{{ role.label }}</span>
          <p class="muted">{{ role.desc }}</p>
        </div>
        <button class="btn" :disabled="signingOut" @click="signOut">{{ signingOut ? 'Keluar…' : 'Keluar' }}</button>
      </div>

      <div class="card">
        <h3>Informasi akun</h3>
        <dl>
          <div><dt>Nama lengkap</dt><dd>{{ user.full_name }}</dd></div>
          <div><dt>Nama pengguna</dt><dd><code>{{ user.username }}</code></dd></div>
          <div><dt>Email</dt><dd>{{ user.email || '—' }}</dd></div>
          <div><dt>Peran</dt><dd>{{ role.label }}</dd></div>
          <div v-if="user.student_id"><dt>NIS</dt><dd>{{ user.student_id }}</dd></div>
          <div v-if="user.teacher_id"><dt>ID guru</dt><dd>{{ user.teacher_id }}</dd></div>
          <div v-if="user.role === 'teacher'">
            <dt>Kelas diampu</dt>
            <dd>
              <template v-if="classes.length"><span v-for="c in classes" :key="c.class_id" class="chip">{{ c.class_name }}</span></template>
              <template v-else>—</template>
            </dd>
          </div>
        </dl>
        <p class="muted small">Untuk mengubah nama, email, atau peran, hubungi admin sekolah.</p>
      </div>

      <form class="card" @submit.prevent="changePassword">
        <h3>Ganti kata sandi</h3>

        <label>Kata sandi saat ini
          <input v-model="pw.current" :type="pw.show ? 'text' : 'password'" autocomplete="current-password" :disabled="pw.done" />
        </label>
        <label>Kata sandi baru
          <input v-model="pw.next" :type="pw.show ? 'text' : 'password'" autocomplete="new-password" :disabled="pw.done" />
        </label>
        <label>Ulangi kata sandi baru
          <input v-model="pw.confirm" :type="pw.show ? 'text' : 'password'" autocomplete="new-password" :disabled="pw.done" />
        </label>

        <label class="check"><input v-model="pw.show" type="checkbox" /> Tampilkan kata sandi</label>

        <ul class="rules">
          <li v-for="r in rules" :key="r.text" :class="{ ok: r.ok }">{{ r.ok ? '✓' : '○' }} {{ r.text }}</li>
        </ul>

        <p v-if="pw.error" class="alert" role="alert">{{ pw.error }}</p>
        <p v-if="pw.done" class="success" role="status">Kata sandi berhasil diganti. Demi keamanan, semua sesi diakhiri — Anda akan diarahkan untuk masuk kembali.</p>

        <div class="foot">
          <button class="btn primary" :disabled="!canSubmit">{{ pw.saving ? 'Menyimpan…' : 'Ganti kata sandi' }}</button>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.prof { --line: #e5e7eb; --muted: #6b7280; max-width: 640px; margin: 0 auto; padding: 16px; color: #111827; display: flex; flex-direction: column; gap: 14px; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 0 0 4px; }
h3 { font-size: .95rem; margin: 0 0 12px; }
.muted { color: var(--muted); margin: 0; font-size: .85rem; }
.small { font-size: .75rem; margin-top: 10px; }
.empty { text-align: center; color: var(--muted); padding: 32px; }
code { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; font-size: .82rem; }

.card { border: 1px solid var(--line); border-radius: 12px; padding: 16px; background: #fff; }
.who { display: flex; gap: 14px; align-items: center; }
.who-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.avatar { width: 56px; height: 56px; border-radius: 50%; background: #dbeafe; color: #1e40af; display: grid; place-items: center; font-weight: 700; font-size: 1.1rem; flex: none; }
.tag { padding: 2px 10px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
.tag.admin { background: #fee2e2; color: #991b1b; }
.tag.teacher { background: #dbeafe; color: #1e40af; }
.tag.student { background: #dcfce7; color: #166534; }

dl { margin: 0; display: grid; gap: 0; }
dl > div { display: grid; grid-template-columns: 140px 1fr; gap: 8px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: .87rem; }
dl > div:last-child { border-bottom: 0; }
dt { color: var(--muted); }
dd { margin: 0; word-break: break-word; }
.chip { display: inline-block; background: #eff6ff; color: #1e40af; border-radius: 999px; padding: 1px 9px; font-size: .78rem; margin: 0 4px 4px 0; }

form.card { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: .78rem; color: var(--muted); }
label.check { flex-direction: row; align-items: center; gap: 6px; }
input[type='password'], input[type='text'] { border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; font: inherit; color: #111827; width: 100%; box-sizing: border-box; }
input:focus { outline: 2px solid #93c5fd; }
input:disabled { background: #f9fafb; }

.rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: .78rem; color: var(--muted); }
.rules li.ok { color: #15803d; }

.btn { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 8px 14px; font: inherit; cursor: pointer; white-space: nowrap; }
.btn:hover:not(:disabled) { background: #f9fafb; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #1d4ed8; }
.link { background: none; border: 0; color: #2563eb; text-decoration: underline; cursor: pointer; font: inherit; }
.foot { display: flex; justify-content: flex-end; }

.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: .85rem; margin: 0; }
.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 8px 12px; border-radius: 8px; font-size: .85rem; margin: 0; }

@media (max-width: 480px) {
  .who { flex-wrap: wrap; }
  dl > div { grid-template-columns: 1fr; gap: 2px; }
  .rules { grid-template-columns: 1fr; }
}
</style>