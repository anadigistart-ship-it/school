<script setup>
/**
 * Pengaturan Sekolah (khusus admin)
 * Backend: settingsGet {} -> { settings }, settingsSave { data } -> { settings }
 * (lihat SchoolSettings.gs)
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/api/client.js' // SESUAIKAN path
import { useAuthStore } from '@/stores/auth' // SESUAIKAN store token

// Beri tahu layout agar memuat ulang nama/logo sekolah setelah disimpan.
const emit = defineEmits(['saved'])

const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)

const FIELDS = ['school_name', 'school_logo', 'school_address', 'school_timezone', 'school_start_time', 'late_threshold', 'academic_year']
const blank = () => ({ school_name: '', school_logo: '', school_address: '', school_timezone: 'Asia/Jakarta', school_start_time: '07:00', late_threshold: '07:15', academic_year: '' })

const form = reactive(blank())
const saved = ref(blank()) // salinan terakhir dari server
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const ok = ref('')
const logoBroken = ref(false)

const ZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura (UTC+9)' },
]
const zones = computed(() =>
  ZONES.some((z) => z.value === form.school_timezone) || !form.school_timezone
    ? ZONES
    : [...ZONES, { value: form.school_timezone, label: form.school_timezone }],
)

const dirty = computed(() => FIELDS.some((k) => form[k] !== saved.value[k]))

function apply(s) {
  const next = { ...blank(), ...s }
  FIELDS.forEach((k) => (form[k] = next[k] ?? ''))
  saved.value = { ...next }
  logoBroken.value = false
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await callApi('settingsGet', {})
    apply(res.settings)
  } catch (e) {
    error.value = e?.message || 'Gagal memuat pengaturan.'
  } finally {
    loading.value = false
  }
}

// ---------- Validasi klien (backend tetap memvalidasi ulang) ----------
const problems = computed(() => {
  const p = {}
  if (!form.school_name.trim()) p.school_name = 'Nama sekolah wajib diisi.'
  if (form.school_logo.trim() && !/^https:\/\/\S+$/.test(form.school_logo.trim())) p.school_logo = 'URL harus diawali https://'
  if (!form.school_start_time) p.school_start_time = 'Isi jam masuk.'
  if (!form.late_threshold) p.late_threshold = 'Isi batas terlambat.'
  else if (form.school_start_time && form.late_threshold < form.school_start_time) p.late_threshold = 'Tidak boleh lebih awal dari jam masuk.'
  const y = /^(\d{4})\/(\d{4})$/.exec(form.academic_year.trim())
  if (form.academic_year.trim() && (!y || +y[2] !== +y[1] + 1)) p.academic_year = 'Format 2026/2027.'
  return p
})
const valid = computed(() => Object.keys(problems.value).length === 0)

function suggestYear() {
  const d = new Date()
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1 // tahun ajaran mulai Juli
  form.academic_year = `${y}/${y + 1}`
}

async function save() {
  if (!valid.value || saving.value) return
  saving.value = true
  error.value = ''
  ok.value = ''
  try {
    const data = {}
    FIELDS.forEach((k) => (data[k] = String(form[k] ?? '').trim()))
    const res = await callApi('settingsSave', { data })
    apply(res.settings)
    ok.value = 'Pengaturan disimpan.'
    emit('saved', res.settings)
    setTimeout(() => (ok.value = ''), 3500)
  } catch (e) {
    error.value = e?.message || 'Gagal menyimpan pengaturan.'
  } finally {
    saving.value = false
  }
}

function discard() {
  apply(saved.value)
  error.value = ''
}

function warnLeave(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => { load(); window.addEventListener('beforeunload', warnLeave) })
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnLeave))
</script>

<template>
  <section class="set">
    <header class="head">
      <h1>Pengaturan Sekolah</h1>
      <p class="muted">Identitas sekolah dan aturan jam absensi. Perubahan langsung berlaku untuk pemindaian berikutnya.</p>
    </header>

    <p v-if="loading" class="empty">Memuat pengaturan…</p>
    <p v-else-if="error && !dirty && !saved.school_name" class="alert" role="alert">{{ error }} <button class="link" @click="load">Coba lagi</button></p>

    <div v-else class="layout">
      <form class="form" @submit.prevent="save">
        <fieldset>
          <legend>Identitas sekolah</legend>

          <label>Nama sekolah
            <input v-model="form.school_name" maxlength="100" placeholder="SD Negeri 1 Contoh" />
            <small v-if="problems.school_name" class="err">{{ problems.school_name }}</small>
          </label>

          <label>Alamat
            <textarea v-model="form.school_address" rows="2" maxlength="250" placeholder="Jl. Pendidikan No. 1, Jakarta" />
          </label>

          <label>URL logo
            <input v-model="form.school_logo" type="url" maxlength="500" placeholder="https://…/logo.png" @input="logoBroken = false" />
            <small v-if="problems.school_logo" class="err">{{ problems.school_logo }}</small>
            <small v-else class="hint">Gunakan tautan langsung ke gambar (https). Kosongkan jika tidak ada logo.</small>
          </label>

          <label>Tahun ajaran
            <div class="row">
              <input v-model="form.academic_year" maxlength="9" placeholder="2026/2027" />
              <button type="button" class="btn sm" @click="suggestYear">Isi otomatis</button>
            </div>
            <small v-if="problems.academic_year" class="err">{{ problems.academic_year }}</small>
          </label>
        </fieldset>

        <fieldset>
          <legend>Aturan absensi</legend>

          <label>Zona waktu
            <select v-model="form.school_timezone">
              <option v-for="z in zones" :key="z.value" :value="z.value">{{ z.label }}</option>
            </select>
            <small class="hint">Menentukan tanggal dan jam pencatatan saat siswa dipindai.</small>
          </label>

          <div class="two">
            <label>Jam masuk
              <input v-model="form.school_start_time" type="time" />
              <small v-if="problems.school_start_time" class="err">{{ problems.school_start_time }}</small>
            </label>
            <label>Batas terlambat
              <input v-model="form.late_threshold" type="time" />
              <small v-if="problems.late_threshold" class="err">{{ problems.late_threshold }}</small>
            </label>
          </div>
          <p class="rule">
            Siswa yang dipindai sampai pukul <b>{{ form.late_threshold || '--:--' }}</b> dicatat <span class="tag ok">Hadir</span>,
            setelah itu dicatat <span class="tag late">Terlambat</span>.
          </p>
        </fieldset>

        <p v-if="error" class="alert" role="alert">{{ error }}</p>
        <p v-if="ok" class="success" role="status">{{ ok }}</p>

        <div class="foot">
          <span v-if="dirty" class="muted">Ada perubahan yang belum disimpan.</span>
          <button type="button" class="btn" :disabled="!dirty || saving" @click="discard">Batalkan</button>
          <button class="btn primary" :disabled="!dirty || !valid || saving">{{ saving ? 'Menyimpan…' : 'Simpan perubahan' }}</button>
        </div>
      </form>

      <aside class="preview">
        <h2>Pratinjau</h2>
        <div class="id">
          <img v-if="form.school_logo && !logoBroken && !problems.school_logo" :src="form.school_logo" alt="Logo sekolah" @error="logoBroken = true" />
          <div v-else class="logo-ph">{{ (form.school_name || 'S').trim().charAt(0).toUpperCase() }}</div>
          <div>
            <strong>{{ form.school_name || 'Nama sekolah' }}</strong>
            <p class="muted">{{ form.school_address || 'Alamat sekolah' }}</p>
            <p v-if="form.academic_year" class="muted">Tahun ajaran {{ form.academic_year }}</p>
          </div>
        </div>
        <p v-if="logoBroken" class="err">Logo tidak bisa dimuat. Periksa URL-nya.</p>
        <div class="times">
          <div><span>Masuk</span><b>{{ form.school_start_time || '--:--' }}</b></div>
          <div><span>Batas terlambat</span><b>{{ form.late_threshold || '--:--' }}</b></div>
          <div><span>Zona</span><b>{{ (zones.find((z) => z.value === form.school_timezone) || {}).label?.split(' — ')[0] || form.school_timezone }}</b></div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.set { --line: #e5e7eb; --muted: #6b7280; max-width: 1000px; margin: 0 auto; padding: 16px; color: #111827; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
h2 { font-size: .95rem; margin: 0 0 12px; }
.muted { color: var(--muted); margin: 0; font-size: .85rem; }
.empty { text-align: center; color: var(--muted); padding: 32px; }

.layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; margin-top: 16px; align-items: start; }
.form { display: flex; flex-direction: column; gap: 16px; }
fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; margin: 0; }
legend { font-weight: 600; font-size: .85rem; padding: 0 6px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: .78rem; color: var(--muted); }
input, select, textarea, .btn { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 8px 12px; font: inherit; color: #111827; }
input, select, textarea { width: 100%; box-sizing: border-box; }
textarea { resize: vertical; }
input:focus, select:focus, textarea:focus { outline: 2px solid #93c5fd; outline-offset: 0; }
.row { display: flex; gap: 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hint { color: var(--muted); font-size: .72rem; }
.err { color: #b91c1c; font-size: .72rem; }
.rule { margin: 0; font-size: .82rem; background: #f9fafb; border-radius: 8px; padding: 8px 12px; }
.tag { padding: 1px 8px; border-radius: 999px; font-size: .72rem; font-weight: 600; }
.tag.ok { background: #dcfce7; color: #166534; }
.tag.late { background: #fef3c7; color: #92400e; }

.btn { cursor: pointer; white-space: nowrap; }
.btn:hover:not(:disabled) { background: #f9fafb; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.sm { padding: 4px 10px; font-size: .8rem; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #1d4ed8; }
.link { background: none; border: 0; color: #2563eb; text-decoration: underline; cursor: pointer; font: inherit; }

.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: .85rem; margin: 0; }
.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 8px 12px; border-radius: 8px; font-size: .85rem; margin: 0; }
.foot { display: flex; justify-content: flex-end; align-items: center; gap: 8px; position: sticky; bottom: 0; background: #fff; padding: 8px 0; }
.foot .muted { margin-right: auto; }

.preview { border: 1px solid var(--line); border-radius: 12px; padding: 16px; position: sticky; top: 16px; }
.id { display: flex; gap: 12px; align-items: center; }
.id img, .logo-ph { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; border: 1px solid var(--line); flex: none; background: #fff; }
.logo-ph { display: grid; place-items: center; font-size: 1.4rem; font-weight: 700; background: #eff6ff; color: #2563eb; }
.id p { margin-top: 2px; }
.times { display: grid; gap: 6px; margin-top: 14px; }
.times div { display: flex; justify-content: space-between; font-size: .82rem; padding: 6px 10px; background: #f9fafb; border-radius: 8px; }
.times span { color: var(--muted); }

@media (max-width: 800px) {
  .layout { grid-template-columns: 1fr; }
  .preview { position: static; order: -1; }
}
@media (max-width: 480px) { .two { grid-template-columns: 1fr; } }
</style>
