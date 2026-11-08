<script setup>
/**
 * Kalender Absensi (admin & guru) + Hari Libur
 * Backend:
 *  - attendanceCalendar { month, class_id? } -> { month, total_students, days[], holidays: [{id,date,name}] }
 *  - holidaySave   { from, to?, name }  (admin)  -> { saved }
 *  - holidayRemove { id }               (admin)
 * Pada tanggal libur, pemindaian absensi ditolak oleh backend (actionScan_).
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { api } from '@/api/client.js' // SESUAIKAN path file api.js milikmu
import { useAuthStore } from '@/stores/auth' // SESUAIKAN: store yang menyimpan token sesi

const props = defineProps({
  // Opsional: [{ class_id: 'CLS-0001', class_name: 'X IPA 1' }]. Kosong = filter kelas disembunyikan.
  classes: { type: Array, default: () => [] },
})
const emit = defineEmits(['open-report'])

// ---------- API ----------
const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)
const isAdmin = computed(() => auth.user?.role === 'admin')

// ---------- State ----------
const today = new Date()
const year = ref(today.getFullYear())
const monthIdx = ref(today.getMonth()) // 0-11
const classId = ref('')
const loading = ref(false)
const error = ref('')
const notice = ref('')
const totalStudents = ref(0)
const byDate = ref({})
const holidays = ref({}) // 'yyyy-MM-dd' -> { id, date, name }
const selected = ref(null) // 'yyyy-MM-dd'

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const HARI = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']
const STATUS = [
  { key: 'hadir', label: 'Hadir', color: '#16a34a' },
  { key: 'terlambat', label: 'Terlambat', color: '#f59e0b' },
  { key: 'izin', label: 'Izin', color: '#3b82f6' },
  { key: 'sakit', label: 'Sakit', color: '#8b5cf6' },
  { key: 'alpha', label: 'Alpha', color: '#dc2626' },
]

const pad = (n) => String(n).padStart(2, '0')
const monthKey = computed(() => `${year.value}-${pad(monthIdx.value + 1)}`)
const title = computed(() => `${BULAN[monthIdx.value]} ${year.value}`)
const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

const fmtLong = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
const fmtShort = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// ---------- Grid kalender (minggu mulai Senin) ----------
const cells = computed(() => {
  const first = new Date(year.value, monthIdx.value, 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year.value, monthIdx.value + 1, 0).getDate()
  const out = []
  for (let i = 0; i < lead; i++) out.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${monthKey.value}-${pad(d)}`
    const dow = (lead + d - 1) % 7
    out.push({ day: d, date, weekend: dow >= 5, data: byDate.value[date] || null, holiday: holidays.value[date] || null })
  }
  while (out.length % 7) out.push(null)
  return out
})

function presentRate(d) {
  const base = totalStudents.value || d.recorded || 0
  return base ? (d.hadir + d.terlambat) / base : 0
}
function rateClass(d) {
  if (!d) return ''
  const r = presentRate(d)
  if (r >= 0.9) return 'good'
  if (r >= 0.75) return 'warn'
  return 'bad'
}
const pct = (d) => Math.round(presentRate(d) * 100)
const canOpen = (c) => !!(c.data || c.holiday || isAdmin.value)

// ---------- Ringkasan bulan ----------
const holidayList = computed(() => Object.values(holidays.value).sort((a, b) => a.date.localeCompare(b.date)))
const summary = computed(() => {
  const days = Object.values(byDate.value)
  const sum = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0 }
  days.forEach((d) => STATUS.forEach((s) => (sum[s.key] += d[s.key] || 0)))
  const total = Object.values(sum).reduce((a, b) => a + b, 0)
  return { days: days.length, sum, total, rate: total ? Math.round(((sum.hadir + sum.terlambat) / total) * 100) : 0 }
})

const selectedData = computed(() => (selected.value ? byDate.value[selected.value] || null : null))
const selectedHoliday = computed(() => (selected.value ? holidays.value[selected.value] || null : null))

// ---------- Data ----------
let reqId = 0
async function load() {
  const id = ++reqId
  loading.value = true
  error.value = ''
  selected.value = null
  try {
    const payload = { month: monthKey.value }
    if (classId.value) payload.class_id = classId.value
    const res = await callApi('attendanceCalendar', payload)
    if (id !== reqId) return // respons usang
    totalStudents.value = res.total_students || 0
    const map = {}
    ;(res.days || []).forEach((d) => (map[d.date] = d))
    byDate.value = map
    const hmap = {}
    ;(res.holidays || []).forEach((h) => (hmap[h.date] = h))
    holidays.value = hmap
  } catch (e) {
    if (id !== reqId) return
    error.value = e?.message || 'Gagal memuat kalender absensi.'
    byDate.value = {}
    holidays.value = {}
  } finally {
    if (id === reqId) loading.value = false
  }
}

function shift(delta) {
  const d = new Date(year.value, monthIdx.value + delta, 1)
  year.value = d.getFullYear()
  monthIdx.value = d.getMonth()
}
function goToday() {
  year.value = today.getFullYear()
  monthIdx.value = today.getMonth()
}
function pick(cell) {
  if (!cell || !canOpen(cell)) return
  selected.value = selected.value === cell.date ? null : cell.date
}

// ---------- Hari libur (admin) ----------
const hf = reactive({ open: false, from: '', to: '', name: '', saving: false, error: '' })
let noticeT
function flash(msg) { notice.value = msg; clearTimeout(noticeT); noticeT = setTimeout(() => (notice.value = ''), 4000) }

function openHoliday(date) {
  const d = date || `${monthKey.value}-01`
  Object.assign(hf, { open: true, from: d, to: d, name: '', saving: false, error: '' })
}

async function saveHoliday() {
  hf.error = ''
  if (!hf.name.trim()) { hf.error = 'Nama hari libur wajib diisi.'; return }
  if (!hf.from || !hf.to) { hf.error = 'Pilih tanggal awal dan akhir.'; return }
  if (hf.to < hf.from) { hf.error = 'Tanggal akhir tidak boleh sebelum tanggal awal.'; return }
  if ((Date.parse(hf.to) - Date.parse(hf.from)) / 86400000 + 1 > 62) { hf.error = 'Maksimal 62 hari per penyimpanan.'; return }
  hf.saving = true
  try {
    const res = await callApi('holidaySave', { from: hf.from, to: hf.to, name: hf.name.trim() })
    hf.open = false
    flash(`${res.saved} hari libur disimpan. Absensi pada tanggal tersebut kini ditolak.`)
    // pindah ke bulan tanggal awal bila berbeda dari bulan yang tampil
    const [y, m] = hf.from.split('-').map(Number)
    if (y !== year.value || m - 1 !== monthIdx.value) { year.value = y; monthIdx.value = m - 1 }
    else await load()
  } catch (e) {
    hf.error = e?.message || 'Gagal menyimpan hari libur.'
  } finally {
    hf.saving = false
  }
}

async function removeHoliday(h) {
  if (!window.confirm(`Hapus hari libur "${h.name}" (${fmtShort(h.date)})? Absensi pada tanggal ini bisa dicatat lagi.`)) return
  try {
    await callApi('holidayRemove', { id: h.id })
    flash('Hari libur dihapus.')
    await load()
  } catch (e) {
    error.value = e?.message || 'Gagal menghapus hari libur.'
  }
}

watch([monthKey, classId], load)
onMounted(load)
</script>

<template>
  <section class="cal">
    <header class="cal-head">
      <div>
        <h1>Kalender Absensi</h1>
        <p class="muted">Ringkasan kehadiran siswa per hari<template v-if="isAdmin">. Klik tanggal untuk melihat rincian atau menetapkan hari libur</template>.</p>
      </div>
      <div class="head-actions">
        <select v-if="classes.length" v-model="classId" class="select" aria-label="Filter kelas">
          <option value="">Semua kelas</option>
          <option v-for="c in classes" :key="c.class_id" :value="c.class_id">{{ c.class_name || c.class_id }}</option>
        </select>
        <button v-if="isAdmin" class="btn" @click="openHoliday(selected)">+ Hari libur</button>
      </div>
    </header>

    <div class="stats">
      <div class="stat"><span class="stat-n">{{ totalStudents }}</span><span class="stat-l">Siswa aktif</span></div>
      <div class="stat"><span class="stat-n">{{ summary.days }}</span><span class="stat-l">Hari tercatat</span></div>
      <div class="stat"><span class="stat-n">{{ holidayList.length }}</span><span class="stat-l">Hari libur</span></div>
      <div class="stat"><span class="stat-n">{{ summary.rate }}%</span><span class="stat-l">Kehadiran bulan ini</span></div>
      <div v-for="s in STATUS.slice(2)" :key="s.key" class="stat">
        <span class="stat-n" :style="{ color: s.color }">{{ summary.sum[s.key] }}</span>
        <span class="stat-l">{{ s.label }}</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="nav">
        <button class="btn" @click="shift(-1)" aria-label="Bulan sebelumnya">‹</button>
        <strong class="month">{{ title }}</strong>
        <button class="btn" @click="shift(1)" aria-label="Bulan berikutnya">›</button>
      </div>
      <button class="btn ghost" @click="goToday">Bulan ini</button>
    </div>

    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="error" class="alert" role="alert">
      {{ error }} <button class="link" @click="load">Coba lagi</button>
    </p>

    <!-- Form hari libur -->
    <form v-if="hf.open" class="hol-form" @submit.prevent="saveHoliday">
      <div class="hol-form-top">
        <h3>Tetapkan hari libur</h3>
        <button type="button" class="btn ghost" aria-label="Tutup" @click="hf.open = false">✕</button>
      </div>
      <label>Nama hari libur
        <input v-model="hf.name" maxlength="100" placeholder="mis. Hari Kemerdekaan, Libur Semester" />
      </label>
      <div class="two">
        <label>Dari tanggal <input v-model="hf.from" type="date" required /></label>
        <label>Sampai tanggal <input v-model="hf.to" type="date" required /></label>
      </div>
      <p class="muted small">Pemindaian absensi pada tanggal ini otomatis ditolak. Tanggal yang sudah berstatus libur akan diperbarui namanya. Catatan absensi yang sudah ada tidak dihapus.</p>
      <p v-if="hf.error" class="alert" role="alert">{{ hf.error }}</p>
      <div class="foot">
        <button type="button" class="btn" @click="hf.open = false">Batal</button>
        <button class="btn primary inline" :disabled="hf.saving">{{ hf.saving ? 'Menyimpan…' : 'Simpan hari libur' }}</button>
      </div>
    </form>

    <div class="grid-wrap" :class="{ loading }">
      <div class="grid head">
        <div v-for="h in HARI" :key="h" class="dow">{{ h }}</div>
      </div>
      <div class="grid">
        <template v-for="(c, i) in cells" :key="i">
          <div v-if="!c" class="cell empty" />
          <button
            v-else
            class="cell"
            :class="[rateClass(c.data), { weekend: c.weekend, today: c.date === todayKey, sel: c.date === selected, has: canOpen(c), holiday: c.holiday }]"
            :disabled="!canOpen(c)"
            :title="c.holiday ? 'Libur: ' + c.holiday.name : ''"
            @click="pick(c)"
          >
            <span class="num">{{ c.day }}</span>
            <span v-if="c.holiday && !c.data" class="hol">{{ c.holiday.name }}</span>
            <template v-if="c.data">
              <span class="pct">{{ pct(c.data) }}%</span>
              <span class="dots">
                <i v-if="c.data.terlambat" class="dot" style="background:#f59e0b" :title="`Terlambat ${c.data.terlambat}`" />
                <i v-if="c.data.izin" class="dot" style="background:#3b82f6" :title="`Izin ${c.data.izin}`" />
                <i v-if="c.data.sakit" class="dot" style="background:#8b5cf6" :title="`Sakit ${c.data.sakit}`" />
                <i v-if="c.data.alpha" class="dot" style="background:#dc2626" :title="`Alpha ${c.data.alpha}`" />
              </span>
            </template>
          </button>
        </template>
      </div>
      <div v-if="loading" class="spinner" aria-live="polite">Memuat…</div>
    </div>

    <div class="legend">
      <span><i class="sw good" /> ≥ 90% hadir</span>
      <span><i class="sw warn" /> 75–89%</span>
      <span><i class="sw bad" /> &lt; 75%</span>
      <span><i class="sw hol-sw" /> Libur (absen ditolak)</span>
      <span class="muted">Persen = (hadir + terlambat) / siswa aktif</span>
    </div>

    <!-- Daftar libur bulan ini -->
    <div v-if="holidayList.length" class="hol-list">
      <h3>Hari libur bulan ini</h3>
      <ul>
        <li v-for="h in holidayList" :key="h.id">
          <b>{{ fmtShort(h.date) }}</b> <span>{{ h.name }}</span>
          <button v-if="isAdmin" class="x" :aria-label="`Hapus ${h.name}`" @click="removeHoliday(h)">✕</button>
        </li>
      </ul>
    </div>

    <transition name="fade">
      <aside v-if="selected" class="detail">
        <div class="detail-top">
          <div>
            <h2>{{ fmtLong(selected) }}</h2>
            <p v-if="selectedData" class="muted">{{ selectedData.recorded }} dari {{ totalStudents }} siswa tercatat</p>
            <p v-else class="muted">Belum ada catatan absensi.</p>
          </div>
          <button class="btn ghost" @click="selected = null" aria-label="Tutup">✕</button>
        </div>

        <div v-if="selectedHoliday" class="banner">
          <div>🗓️ <b>Hari libur:</b> {{ selectedHoliday.name }}<br /><small>Pemindaian absensi ditolak pada tanggal ini.</small></div>
          <button v-if="isAdmin" class="btn danger" @click="removeHoliday(selectedHoliday)">Hapus libur</button>
        </div>
        <button v-else-if="isAdmin" class="btn wide" @click="openHoliday(selected)">Jadikan hari libur</button>

        <template v-if="selectedData">
          <div class="bar" role="img" :aria-label="`Kehadiran ${pct(selectedData)}%`">
            <span
              v-for="s in STATUS"
              :key="s.key"
              :style="{ width: (selectedData[s.key] / (totalStudents || selectedData.recorded || 1)) * 100 + '%', background: s.color }"
            />
          </div>

          <ul class="rows">
            <li v-for="s in STATUS" :key="s.key">
              <i class="dot lg" :style="{ background: s.color }" />
              <span>{{ s.label }}</span>
              <b>{{ selectedData[s.key] }}</b>
            </li>
            <li v-if="totalStudents > selectedData.recorded" class="muted">
              <i class="dot lg" style="background:#cbd5e1" />
              <span>Belum tercatat</span>
              <b>{{ totalStudents - selectedData.recorded }}</b>
            </li>
          </ul>

          <button class="btn primary" @click="emit('open-report', { from: selected, to: selected, class_id: classId || undefined })">
            Lihat laporan detail
          </button>
        </template>
      </aside>
    </transition>
  </section>
</template>

<style scoped>
.cal { --line: #e5e7eb; --muted: #6b7280; max-width: 980px; margin: 0 auto; padding: 16px; color: #111827; }
.cal-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.head-actions { display: flex; gap: 8px; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
h2 { font-size: 1.05rem; margin: 0; text-transform: capitalize; }
h3 { font-size: .9rem; margin: 0 0 8px; }
.muted { color: var(--muted); font-size: .85rem; margin: 0; }
.small { font-size: .75rem; }

.select, .btn, input { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 8px 12px; font: inherit; }
.btn { cursor: pointer; }
.btn:hover:not(:disabled) { background: #f9fafb; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.ghost { background: transparent; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; width: 100%; margin-top: 12px; }
.btn.primary.inline { width: auto; margin-top: 0; }
.btn.primary:hover:not(:disabled) { background: #1d4ed8; }
.btn.danger { color: #b91c1c; border-color: #fecaca; white-space: nowrap; }
.btn.wide { width: 100%; margin-top: 12px; }
.link { background: none; border: 0; color: #2563eb; text-decoration: underline; cursor: pointer; font: inherit; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 8px; margin: 16px 0; }
.stat { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; }
.stat-n { font-size: 1.3rem; font-weight: 700; }
.stat-l { font-size: .75rem; color: var(--muted); }

.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.nav { display: flex; align-items: center; gap: 10px; }
.month { min-width: 150px; text-align: center; }

.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: .85rem; }
.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 8px 12px; border-radius: 8px; font-size: .85rem; }

.hol-form { border: 1px solid #fecaca; background: #fffafa; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; }
.hol-form-top { display: flex; justify-content: space-between; align-items: center; }
.hol-form-top h3 { margin: 0; }
.hol-form label { display: flex; flex-direction: column; gap: 4px; font-size: .78rem; color: var(--muted); }
.hol-form input { width: 100%; box-sizing: border-box; color: #111827; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.foot { display: flex; justify-content: flex-end; gap: 8px; }

.grid-wrap { position: relative; }
.grid-wrap.loading .grid { opacity: .45; pointer-events: none; }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; transition: opacity .15s; }
.grid.head { margin-bottom: 4px; }
.dow { text-align: center; font-size: .75rem; font-weight: 600; color: var(--muted); padding: 4px 0; }
.spinner { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); }

.cell { aspect-ratio: 1 / 0.85; min-height: 56px; border: 1px solid var(--line); border-radius: 8px; background: #fff;
  padding: 4px 6px; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; font: inherit; text-align: left; overflow: hidden; }
.cell.empty { border: 0; background: transparent; }
.cell:disabled { cursor: default; }
.cell.weekend:not(.has):not(.holiday) { background: #f9fafb; color: #9ca3af; }
.cell.has { cursor: pointer; }
.cell.has:hover { box-shadow: 0 0 0 2px #93c5fd; }
.cell.good { background: #f0fdf4; border-color: #bbf7d0; }
.cell.warn { background: #fffbeb; border-color: #fde68a; }
.cell.bad { background: #fef2f2; border-color: #fecaca; }
.cell.holiday { background: repeating-linear-gradient(135deg, #fef2f2, #fef2f2 6px, #fee2e2 6px, #fee2e2 12px); border-color: #fca5a5; color: #991b1b; }
.cell.today .num { background: #2563eb; color: #fff; border-radius: 999px; padding: 0 6px; }
.cell.sel { box-shadow: 0 0 0 2px #2563eb; }
.num { font-size: .8rem; font-weight: 600; }
.hol { font-size: .65rem; line-height: 1.15; font-weight: 600; max-height: 2.4em; overflow: hidden; word-break: break-word; }
.pct { font-size: .85rem; font-weight: 700; align-self: flex-end; }
.dots { display: flex; gap: 3px; min-height: 8px; }
.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.dot.lg { width: 10px; height: 10px; }

.legend { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 12px; font-size: .8rem; }
.sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--line); vertical-align: -1px; }
.sw.good { background: #f0fdf4; border-color: #bbf7d0; }
.sw.warn { background: #fffbeb; border-color: #fde68a; }
.sw.bad { background: #fef2f2; border-color: #fecaca; }
.sw.hol-sw { background: repeating-linear-gradient(135deg, #fef2f2, #fef2f2 3px, #fecaca 3px, #fecaca 6px); border-color: #fca5a5; }

.hol-list { margin-top: 14px; }
.hol-list ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.hol-list li { display: flex; align-items: center; gap: 6px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 999px; padding: 3px 6px 3px 12px; font-size: .8rem; }
.hol-list li:not(:has(.x)) { padding-right: 12px; }
.x { background: none; border: 0; cursor: pointer; color: #b91c1c; font-size: .75rem; border-radius: 50%; width: 20px; height: 20px; }
.x:hover { background: #fee2e2; }

.detail { margin-top: 16px; border: 1px solid var(--line); border-radius: 12px; padding: 16px; background: #fff; }
.detail-top { display: flex; justify-content: space-between; gap: 8px; }
.banner { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 10px; padding: 10px 12px; font-size: .85rem; }
.bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: #e5e7eb; margin: 12px 0; }
.rows { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.rows li { display: flex; align-items: center; gap: 8px; }
.rows li span { flex: 1; }

.fade-enter-active, .fade-leave-active { transition: opacity .15s, transform .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(4px); }

@media (max-width: 560px) {
  .cell { min-height: 48px; padding: 3px 4px; }
  .pct { font-size: .7rem; }
  .hol { font-size: .58rem; }
  .month { min-width: 120px; }
  .two { grid-template-columns: 1fr; }
}
</style>
