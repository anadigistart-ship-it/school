<script setup>
/**
 * Laporan Absensi (admin & guru)
 * Backend: attendanceReport  { from, to, class_id? }
 *   -> { from, to, effective_days, totals, students[], records[], truncated }
 * Daftar kelas: aksi `options` -> { classes: [{ class_id, class_name }] } (guru hanya melihat kelasnya).
 *
 * Props opsional (mis. dari route.query saat datang dari Kalender Absensi): from, to, classId
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { api } from '@/api/client.js' // SESUAIKAN path
import { useAuthStore } from '@/stores/auth' // SESUAIKAN store token

const props = defineProps({
  from: { type: String, default: '' },
  to: { type: String, default: '' },
  classId: { type: String, default: '' },
})

const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()

const filters = reactive({
  from: props.from || ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
  to: props.to || ymd(now),
  class_id: props.classId || '',
})

const STATUS = [
  { key: 'hadir', label: 'Hadir', color: '#16a34a' },
  { key: 'terlambat', label: 'Terlambat', color: '#f59e0b' },
  { key: 'izin', label: 'Izin', color: '#3b82f6' },
  { key: 'sakit', label: 'Sakit', color: '#8b5cf6' },
  { key: 'alpha', label: 'Alpha', color: '#dc2626' },
]
const statusLabel = (k) => STATUS.find((s) => s.key === k)?.label || 'Lainnya'
const statusColor = (k) => STATUS.find((s) => s.key === k)?.color || '#6b7280'

const classes = ref([])
const report = ref(null)
const loading = ref(false)
const error = ref('')
const tab = ref('students') // students | records

// Tabel siswa
const search = ref('')
const sortKey = ref('full_name')
const sortDir = ref(1)

// Tabel catatan
const recStatus = ref('')
const recPage = ref(1)
const REC_SIZE = 25

const rangeError = computed(() => {
  if (!filters.from || !filters.to) return 'Pilih tanggal awal dan akhir.'
  if (filters.from > filters.to) return 'Tanggal awal tidak boleh setelah tanggal akhir.'
  const days = (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000
  if (days > 92) return 'Rentang tanggal maksimal 93 hari.'
  return ''
})

// ---------- Data ----------
let reqId = 0
async function load() {
  if (rangeError.value) { error.value = rangeError.value; return }
  const id = ++reqId
  loading.value = true
  error.value = ''
  try {
    const payload = { from: filters.from, to: filters.to }
    if (filters.class_id) payload.class_id = filters.class_id
    const res = await callApi('attendanceReport', payload)
    if (id !== reqId) return
    report.value = res
    recPage.value = 1
  } catch (e) {
    if (id !== reqId) return
    error.value = e?.message || 'Gagal memuat laporan.'
    report.value = null
  } finally {
    if (id === reqId) loading.value = false
  }
}

async function loadClasses() {
  try {
    const res = await callApi('options', {})
    classes.value = res.classes || []
  } catch { /* filter kelas opsional */ }
}

function applyPreset(kind) {
  const d = new Date()
  if (kind === 'month') {
    filters.from = ymd(new Date(d.getFullYear(), d.getMonth(), 1))
    filters.to = ymd(d)
  } else if (kind === 'lastmonth') {
    filters.from = ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1))
    filters.to = ymd(new Date(d.getFullYear(), d.getMonth(), 0))
  } else if (kind === '7') {
    const s = new Date(d); s.setDate(d.getDate() - 6)
    filters.from = ymd(s); filters.to = ymd(d)
  }
  load()
}

// ---------- Turunan ----------
const totals = computed(() => report.value?.totals || null)
const className = computed(() => classes.value.find((c) => c.class_id === filters.class_id)?.class_name || 'Semua kelas')

const students = computed(() => {
  let rows = (report.value?.students || []).slice()
  const q = search.value.trim().toLowerCase()
  if (q) rows = rows.filter((r) => `${r.full_name} ${r.student_id} ${r.class_name}`.toLowerCase().includes(q))
  const k = sortKey.value
  rows.sort((a, b) => {
    const x = a[k], y = b[k]
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortDir.value
    return String(x).localeCompare(String(y), 'id') * sortDir.value
  })
  return rows
})

function sortBy(k) {
  if (sortKey.value === k) sortDir.value *= -1
  else { sortKey.value = k; sortDir.value = k === 'full_name' || k === 'class_name' ? 1 : -1 }
}
const arrow = (k) => (sortKey.value === k ? (sortDir.value === 1 ? ' ▲' : ' ▼') : '')

const records = computed(() => {
  const rows = report.value?.records || []
  return recStatus.value ? rows.filter((r) => r.status === recStatus.value) : rows
})
const recPages = computed(() => Math.max(1, Math.ceil(records.value.length / REC_SIZE)))
const recSlice = computed(() => records.value.slice((recPage.value - 1) * REC_SIZE, recPage.value * REC_SIZE))
watch(recStatus, () => (recPage.value = 1))

const rateClass = (r) => (r >= 90 ? 'good' : r >= 75 ? 'warn' : 'bad')

function fmtDate(d) {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(y, m - 1, dd).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
const periodLabel = computed(() => `${fmtDate(filters.from)} – ${fmtDate(filters.to)}`)

// ---------- Ekspor ----------
function csvCell(v) {
  const s = String(v ?? '')
  // cegah injeksi rumus saat dibuka di Excel
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s
  return `"${safe.replace(/"/g, '""')}"`
}
function download(name, rows) {
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
function exportCsv() {
  if (!report.value) return
  const base = `absensi_${filters.from}_${filters.to}`
  if (tab.value === 'students') {
    download(`${base}_rekap.csv`, [
      ['NIS', 'Nama', 'Kelas', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha', 'Belum tercatat', '% Kehadiran'],
      ...students.value.map((s) => [s.student_id, s.full_name, s.class_name, s.hadir, s.terlambat, s.izin, s.sakit, s.alpha, s.unrecorded, s.rate]),
    ])
  } else {
    download(`${base}_catatan.csv`, [
      ['Tanggal', 'Jam', 'NIS', 'Nama', 'Kelas', 'Status', 'Sumber'],
      ...records.value.map((r) => [r.date, r.check_in_time, r.student_id, r.student_name, r.class_name, statusLabel(r.status), r.source]),
    ])
  }
}

const printPage = () => window.print()

onMounted(() => { loadClasses(); load() })
</script>

<template>
  <section class="rep">
    <header class="head no-print">
      <div>
        <h1>Laporan Absensi</h1>
        <p class="muted">Rekap kehadiran siswa per periode. Satu catatan terakhir dihitung per siswa per tanggal.</p>
      </div>
      <div class="actions">
        <button class="btn" :disabled="!report" @click="exportCsv">Unduh CSV</button>
        <button class="btn" :disabled="!report" @click="printPage">Cetak</button>
      </div>
    </header>

    <form class="filters no-print" @submit.prevent="load">
      <label>Dari <input v-model="filters.from" type="date" required /></label>
      <label>Sampai <input v-model="filters.to" type="date" required /></label>
      <label v-if="classes.length">Kelas
        <select v-model="filters.class_id">
          <option value="">Semua kelas</option>
          <option v-for="c in classes" :key="c.class_id" :value="c.class_id">{{ c.class_name }}</option>
        </select>
      </label>
      <button class="btn primary" :disabled="loading || !!rangeError">{{ loading ? 'Memuat…' : 'Tampilkan' }}</button>
      <div class="presets">
        <button type="button" class="chip" @click="applyPreset('7')">7 hari</button>
        <button type="button" class="chip" @click="applyPreset('month')">Bulan ini</button>
        <button type="button" class="chip" @click="applyPreset('lastmonth')">Bulan lalu</button>
      </div>
    </form>
    <p v-if="rangeError" class="hint no-print">{{ rangeError }}</p>

    <p v-if="error && !rangeError" class="alert" role="alert">{{ error }} <button class="link" @click="load">Coba lagi</button></p>

    <div class="print-title">
      <strong>Laporan Absensi — {{ className }}</strong><br />{{ periodLabel }}
    </div>

    <template v-if="report">
      <div class="cards">
        <div class="card"><b>{{ report.effective_days }}</b><span>Hari efektif</span></div>
        <div class="card"><b>{{ totals.students }}</b><span>Siswa</span></div>
        <div class="card"><b :class="rateClass(totals.rate)">{{ totals.rate }}%</b><span>Kehadiran</span></div>
        <div v-for="s in STATUS" :key="s.key" class="card">
          <b :style="{ color: s.color }">{{ totals[s.key] }}</b><span>{{ s.label }}</span>
        </div>
        <div class="card"><b>{{ totals.unrecorded }}</b><span>Belum tercatat</span></div>
      </div>

      <p v-if="!report.effective_days" class="empty">Belum ada catatan absensi pada periode ini.</p>

      <template v-else>
        <div class="tabs no-print">
          <button :class="{ on: tab === 'students' }" @click="tab = 'students'">Rekap per siswa</button>
          <button :class="{ on: tab === 'records' }" @click="tab = 'records'">Catatan harian</button>
        </div>

        <!-- Rekap siswa -->
        <div v-if="tab === 'students'" class="block">
          <input v-model="search" class="search no-print" type="search" placeholder="Cari nama, NIS, atau kelas…" />
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th @click="sortBy('full_name')">Nama{{ arrow('full_name') }}</th>
                  <th @click="sortBy('class_name')">Kelas{{ arrow('class_name') }}</th>
                  <th v-for="s in STATUS" :key="s.key" class="num" @click="sortBy(s.key)">{{ s.label }}{{ arrow(s.key) }}</th>
                  <th class="num" @click="sortBy('unrecorded')">Kosong{{ arrow('unrecorded') }}</th>
                  <th class="num" @click="sortBy('rate')">%{{ arrow('rate') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in students" :key="s.student_id">
                  <td>{{ s.full_name }}<small>{{ s.student_id }}</small></td>
                  <td>{{ s.class_name }}</td>
                  <td v-for="st in STATUS" :key="st.key" class="num">{{ s[st.key] || '·' }}</td>
                  <td class="num">{{ s.unrecorded || '·' }}</td>
                  <td class="num"><span class="pill" :class="rateClass(s.rate)">{{ s.rate }}%</span></td>
                </tr>
                <tr v-if="!students.length"><td colspan="9" class="empty">Tidak ada siswa yang cocok.</td></tr>
              </tbody>
            </table>
          </div>
          <p class="muted small">"Kosong" = hari efektif tanpa catatan untuk siswa tersebut.</p>
        </div>

        <!-- Catatan harian -->
        <div v-else class="block">
          <div class="rec-tools no-print">
            <select v-model="recStatus">
              <option value="">Semua status</option>
              <option v-for="s in STATUS" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
            <span class="muted small">{{ records.length }} catatan</span>
          </div>
          <p v-if="report.truncated" class="alert">Hanya 3.000 catatan terbaru yang ditampilkan. Persempit rentang tanggal atau pilih satu kelas.</p>
          <div class="scroll">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Jam</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Sumber</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in recSlice" :key="r.student_id + r.date">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td>{{ r.check_in_time || '–' }}</td>
                  <td>{{ r.student_name }}<small>{{ r.student_id }}</small></td>
                  <td>{{ r.class_name }}</td>
                  <td><span class="tag" :style="{ background: statusColor(r.status) }">{{ statusLabel(r.status) }}</span></td>
                  <td>{{ r.source || '–' }}</td>
                </tr>
                <tr v-if="!recSlice.length"><td colspan="6" class="empty">Tidak ada catatan.</td></tr>
              </tbody>
            </table>
          </div>
          <div v-if="recPages > 1" class="pager no-print">
            <button class="btn" :disabled="recPage <= 1" @click="recPage--">‹</button>
            <span>{{ recPage }} / {{ recPages }}</span>
            <button class="btn" :disabled="recPage >= recPages" @click="recPage++">›</button>
          </div>
        </div>
      </template>
    </template>

    <p v-else-if="loading" class="empty">Memuat laporan…</p>
  </section>
</template>

<style scoped>
.rep { --line: #e5e7eb; --muted: #6b7280; max-width: 1100px; margin: 0 auto; padding: 16px; color: #111827; }
.head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
.muted { color: var(--muted); margin: 0; font-size: .85rem; }
.small { font-size: .75rem; margin-top: 6px; }
.actions { display: flex; gap: 8px; }

.btn, input, select { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 8px 12px; font: inherit; }
.btn { cursor: pointer; }
.btn:hover:not(:disabled) { background: #f9fafb; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #1d4ed8; }
.link { background: none; border: 0; color: #2563eb; text-decoration: underline; cursor: pointer; font: inherit; }

.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin: 16px 0 4px; }
.filters label { display: flex; flex-direction: column; gap: 4px; font-size: .75rem; color: var(--muted); }
.presets { display: flex; gap: 6px; margin-left: auto; }
.chip { border: 1px solid var(--line); background: #f9fafb; border-radius: 999px; padding: 6px 12px; font: inherit; font-size: .8rem; cursor: pointer; }
.chip:hover { background: #eef2ff; }
.hint { color: #b45309; font-size: .8rem; margin: 4px 0; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin: 16px 0; }
.card { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; }
.card b { font-size: 1.3rem; }
.card span { font-size: .75rem; color: var(--muted); }
b.good { color: #16a34a; } b.warn { color: #d97706; } b.bad { color: #dc2626; }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
.tabs button { background: none; border: 0; padding: 8px 14px; font: inherit; cursor: pointer; border-bottom: 2px solid transparent; color: var(--muted); }
.tabs button.on { color: #2563eb; border-color: #2563eb; font-weight: 600; }

.search { width: 100%; max-width: 360px; margin-bottom: 10px; }
.rec-tools { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { background: #f9fafb; font-size: .75rem; text-transform: uppercase; letter-spacing: .02em; color: var(--muted); cursor: pointer; user-select: none; position: sticky; top: 0; }
th.num, td.num { text-align: right; }
tbody tr:hover { background: #f9fafb; }
tr:last-child td { border-bottom: 0; }
td small { display: block; color: var(--muted); font-size: .7rem; }
.pill { padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: .75rem; }
.pill.good { background: #dcfce7; color: #166534; }
.pill.warn { background: #fef3c7; color: #92400e; }
.pill.bad { background: #fee2e2; color: #991b1b; }
.tag { color: #fff; padding: 2px 8px; border-radius: 6px; font-size: .75rem; }
.empty { text-align: center; color: var(--muted); padding: 24px 8px; }
.pager { display: flex; gap: 12px; justify-content: center; align-items: center; margin-top: 12px; }

.print-title { display: none; }

@media (max-width: 560px) { .presets { margin-left: 0; width: 100%; } }
@media print {
  .no-print { display: none !important; }
  .print-title { display: block; margin-bottom: 12px; }
  .rep { padding: 0; max-width: none; }
  .scroll { overflow: visible; border: 0; }
  th { position: static; }
  .card { break-inside: avoid; }
}
</style>
