<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  ClipboardList,
  Download,
  Search,
  AlertCircle,
  LoaderCircle,
  UserCheck,
  Clock,
  FileText,
  UserX,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'

/*
 * ADAPTER API — samakan dengan yang dipakai di ClassesView.vue.
 * callApi(action, payload) -> isi `data` dari backend, atau melempar Error(.message).
 */
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth' // sesuaikan lokasi token Anda

const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)

// ---------- State ----------
const classes = ref([])
const classId = ref('')
const from = ref('')
const to = ref('')
const preset = ref('month')

const report = ref(null)
const loading = ref(false)
const error = ref('')

const tab = ref('students') // students | records
const search = ref('')
const statusFilter = ref('')
const sortKey = ref('full_name')
const sortDir = ref('asc')
const page = ref(1)
const pageSize = 15

const STATUS = {
  hadir: { label: 'Hadir', cls: 'bg-emerald-50 text-emerald-700' },
  terlambat: { label: 'Terlambat', cls: 'bg-amber-50 text-amber-700' },
  izin: { label: 'Izin', cls: 'bg-blue-50 text-blue-700' },
  sakit: { label: 'Sakit', cls: 'bg-violet-50 text-violet-700' },
  alpha: { label: 'Alpha', cls: 'bg-red-50 text-red-700' },
  lainnya: { label: 'Lainnya', cls: 'bg-slate-100 text-slate-600' },
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// ---------- Helper tanggal ----------
function iso(d) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!m) return String(value || '-')
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`
}

function setPreset(name) {
  const now = new Date()
  preset.value = name

  if (name === 'today') {
    from.value = to.value = iso(now)
  } else if (name === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    from.value = iso(start)
    to.value = iso(now)
  } else if (name === 'month') {
    from.value = iso(new Date(now.getFullYear(), now.getMonth(), 1))
    to.value = iso(now)
  } else if (name === 'lastMonth') {
    from.value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    to.value = iso(new Date(now.getFullYear(), now.getMonth(), 0))
  }
}

const PRESETS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: '7 hari terakhir' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'lastMonth', label: 'Bulan lalu' },
]

// ---------- Muat data ----------
async function load() {
  if (!from.value || !to.value) return

  if (from.value > to.value) {
    error.value = 'Tanggal awal tidak boleh setelah tanggal akhir.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    report.value = await callApi('attendanceReport', {
      from: from.value,
      to: to.value,
      class_id: classId.value,
    })
  } catch (e) {
    error.value = e.message || 'Gagal memuat rekap absensi.'
    report.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const opt = await callApi('options', {})
    classes.value = opt.classes || []
  } catch (e) {
    error.value = e.message || 'Gagal memuat pilihan kelas.'
  }

  setPreset('month') // memicu watch -> load()
})

watch([classId, from, to], load)

watch([tab, search, statusFilter, report], () => {
  page.value = 1
})

// ---------- Data turunan ----------
const totals = computed(() => report.value?.totals || {
  students: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0, unrecorded: 0, rate: 0,
})

const studentRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const dir = sortDir.value === 'desc' ? -1 : 1
  const key = sortKey.value

  return (report.value?.students || [])
    .filter((s) => !q || [s.full_name, s.student_id, s.class_name].some((v) => String(v).toLowerCase().includes(q)))
    .sort((a, b) => {
      if (key === 'rate') return (a.rate - b.rate) * dir
      return String(a[key]).localeCompare(String(b[key]), 'id') * dir
    })
})

const recordRows = computed(() => {
  const q = search.value.trim().toLowerCase()

  return (report.value?.records || []).filter((r) => {
    if (statusFilter.value && r.status !== statusFilter.value) return false
    if (!q) return true
    return [r.student_name, r.student_id, r.class_name].some((v) => String(v).toLowerCase().includes(q))
  })
})

const activeRows = computed(() => (tab.value === 'students' ? studentRows.value : recordRows.value))
const pages = computed(() => Math.max(1, Math.ceil(activeRows.value.length / pageSize)))

const pagedRows = computed(() => {
  const p = Math.min(page.value, pages.value)
  return activeRows.value.slice((p - 1) * pageSize, p * pageSize)
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'rate' ? 'desc' : 'asc'
  }
}

function rateColor(rate) {
  if (rate >= 90) return 'bg-emerald-500'
  if (rate >= 75) return 'bg-amber-500'
  return 'bg-red-500'
}

// ---------- Unduh CSV ----------
function csvCell(v) {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv() {
  if (!report.value) return

  let header
  let lines

  if (tab.value === 'students') {
    header = ['NISN', 'Nama', 'Kelas', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha', 'Belum tercatat', 'Kehadiran (%)']
    lines = studentRows.value.map((s) => [
      s.student_id, s.full_name, s.class_name, s.hadir, s.terlambat, s.izin, s.sakit, s.alpha, s.unrecorded, s.rate,
    ])
  } else {
    header = ['Tanggal', 'Jam', 'NISN', 'Nama', 'Kelas', 'Status', 'Sumber']
    lines = recordRows.value.map((r) => [
      r.date, r.check_in_time, r.student_id, r.student_name, r.class_name,
      (STATUS[r.status] || STATUS.lainnya).label, r.source,
    ])
  }

  // Titik koma + BOM agar terbuka rapi di Excel versi Indonesia.
  const csv = '\ufeff' + [header, ...lines].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')

  a.href = url
  a.download = `rekap-absensi-${tab.value === 'students' ? 'siswa' : 'harian'}_${from.value}_${to.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">

    <!-- HEADER -->
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div class="relative overflow-hidden bg-gradient-to-r from-[#10264d] via-[#173b78] to-[#2452cf] px-6 py-6 text-white">

        <div class="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[25px] border-white/5"></div>
        <div class="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-amber-400/10"></div>

        <div class="relative flex flex-wrap items-center justify-between gap-4">

          <div class="flex items-center gap-4">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
              <ClipboardList :size="30" />
            </div>

            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Laporan
              </div>
              <h1 class="mt-1 text-2xl font-extrabold tracking-tight">Rekap Absensi</h1>
              <p class="mt-1 text-sm text-blue-100">
                {{ formatDate(from) }} – {{ formatDate(to) }}
              </p>
            </div>
          </div>

          <BaseButton :disabled="!report || loading" @click="downloadCsv">
            <Download class="mr-2 h-4 w-4" />
            Unduh CSV
          </BaseButton>

        </div>
      </div>

      <!-- FILTER -->
      <div class="space-y-4 p-5">

        <div class="flex flex-wrap items-end gap-4">

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Kelas</label>
            <select
              v-model="classId"
              class="min-w-[180px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Semua kelas</option>
              <option v-for="c in classes" :key="c.class_id" :value="c.class_id">
                {{ c.class_name }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Dari tanggal</label>
            <input
              v-model="from"
              type="date"
              class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              @input="preset = ''"
            />
          </div>

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Sampai tanggal</label>
            <input
              v-model="to"
              type="date"
              class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              @input="preset = ''"
            />
          </div>

        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in PRESETS"
            :key="p.key"
            class="rounded-full border px-3.5 py-1.5 text-xs font-bold transition"
            :class="preset === p.key
              ? 'border-[#173b78] bg-[#173b78] text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'"
            @click="setPreset(p.key)"
          >
            {{ p.label }}
          </button>
        </div>

      </div>
    </div>

    <!-- ERROR -->
    <div
      v-if="error"
      class="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      role="alert"
    >
      <AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
      <div class="flex-1">{{ error }}</div>
      <button class="font-semibold underline" @click="load">Coba lagi</button>
    </div>

    <!-- RINGKASAN -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-5">

      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <UserCheck class="h-4 w-4 text-emerald-600" /> Hadir
        </div>
        <div class="mt-2 text-2xl font-extrabold text-slate-800">{{ totals.hadir }}</div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Clock class="h-4 w-4 text-amber-600" /> Terlambat
        </div>
        <div class="mt-2 text-2xl font-extrabold text-slate-800">{{ totals.terlambat }}</div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <FileText class="h-4 w-4 text-blue-600" /> Izin / Sakit
        </div>
        <div class="mt-2 text-2xl font-extrabold text-slate-800">{{ totals.izin + totals.sakit }}</div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <UserX class="h-4 w-4 text-red-600" /> Alpha
        </div>
        <div class="mt-2 text-2xl font-extrabold text-slate-800">{{ totals.alpha }}</div>
        <div class="text-xs text-slate-400">+ {{ totals.unrecorded }} belum tercatat</div>
      </div>

      <div class="col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-[#10264d] to-[#2452cf] p-4 text-white shadow-sm lg:col-span-1">
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-100">
          <TrendingUp class="h-4 w-4" /> Kehadiran
        </div>
        <div class="mt-2 text-2xl font-extrabold">{{ totals.rate }}%</div>
        <div class="text-xs text-blue-200">{{ report?.effective_days || 0 }} hari efektif</div>
      </div>

    </div>

    <!-- TAB + PENCARIAN -->
    <div class="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

      <div class="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          class="rounded-lg px-4 py-2 text-sm font-bold transition"
          :class="tab === 'students' ? 'bg-white text-[#173b78] shadow-sm' : 'text-slate-500'"
          @click="tab = 'students'"
        >
          Per Siswa
        </button>
        <button
          class="rounded-lg px-4 py-2 text-sm font-bold transition"
          :class="tab === 'records' ? 'bg-white text-[#173b78] shadow-sm' : 'text-slate-500'"
          @click="tab = 'records'"
        >
          Riwayat Harian
        </button>
      </div>

      <div class="flex flex-wrap items-end gap-3">

        <div v-if="tab === 'records'">
          <select
            v-model="statusFilter"
            class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            aria-label="Filter status"
          >
            <option value="">Semua status</option>
            <option v-for="(m, key) in STATUS" :key="key" :value="key">{{ m.label }}</option>
          </select>
        </div>

        <div class="relative min-w-[220px]">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="search"
            type="search"
            placeholder="Cari nama atau NISN"
            class="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

      </div>
    </div>

    <!-- LOADING -->
    <div
      v-if="loading"
      class="flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-8 text-sm font-medium text-blue-700"
    >
      <LoaderCircle class="h-5 w-5 animate-spin" />
      Memuat rekap absensi...
    </div>

    <!-- TABEL -->
    <div v-else-if="report" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div class="overflow-x-auto">

        <!-- PER SISWA -->
        <table v-if="tab === 'students'" class="w-full min-w-[820px] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3">
                <button class="inline-flex items-center gap-1 font-bold" @click="toggleSort('full_name')">
                  Siswa <ArrowUpDown class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-3 py-3 text-center font-bold">Hadir</th>
              <th class="px-3 py-3 text-center font-bold">Terlambat</th>
              <th class="px-3 py-3 text-center font-bold">Izin</th>
              <th class="px-3 py-3 text-center font-bold">Sakit</th>
              <th class="px-3 py-3 text-center font-bold">Alpha</th>
              <th class="px-3 py-3 text-center font-bold">Belum tercatat</th>
              <th class="px-5 py-3">
                <button class="inline-flex items-center gap-1 font-bold" @click="toggleSort('rate')">
                  Kehadiran <ArrowUpDown class="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr v-for="s in pagedRows" :key="s.student_id" class="transition hover:bg-blue-50/40">
              <td class="px-5 py-3">
                <div class="font-bold text-slate-800">{{ s.full_name }}</div>
                <div class="text-xs text-slate-400">{{ s.student_id }} · {{ s.class_name }}</div>
              </td>
              <td class="px-3 py-3 text-center font-semibold text-emerald-700">{{ s.hadir }}</td>
              <td class="px-3 py-3 text-center font-semibold text-amber-700">{{ s.terlambat }}</td>
              <td class="px-3 py-3 text-center font-semibold text-blue-700">{{ s.izin }}</td>
              <td class="px-3 py-3 text-center font-semibold text-violet-700">{{ s.sakit }}</td>
              <td class="px-3 py-3 text-center font-semibold text-red-700">{{ s.alpha }}</td>
              <td class="px-3 py-3 text-center text-slate-500">{{ s.unrecorded }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full" :class="rateColor(s.rate)" :style="{ width: s.rate + '%' }"></div>
                  </div>
                  <span class="text-xs font-bold text-slate-700">{{ s.rate }}%</span>
                </div>
              </td>
            </tr>

            <tr v-if="!pagedRows.length">
              <td colspan="8" class="px-5 py-10 text-center text-sm text-slate-400">
                Tidak ada data siswa pada filter ini.
              </td>
            </tr>
          </tbody>
        </table>

        <!-- RIWAYAT HARIAN -->
        <table v-else class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3 font-bold">Tanggal</th>
              <th class="px-3 py-3 font-bold">Jam</th>
              <th class="px-3 py-3 font-bold">Siswa</th>
              <th class="px-3 py-3 font-bold">Kelas</th>
              <th class="px-3 py-3 font-bold">Status</th>
              <th class="px-5 py-3 font-bold">Sumber</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="r in pagedRows"
              :key="r.student_id + r.date"
              class="transition hover:bg-blue-50/40"
            >
              <td class="px-5 py-3 text-slate-700">{{ formatDate(r.date) }}</td>
              <td class="px-3 py-3 text-slate-500">{{ r.check_in_time || '-' }}</td>
              <td class="px-3 py-3">
                <div class="font-bold text-slate-800">{{ r.student_name }}</div>
                <div class="text-xs text-slate-400">{{ r.student_id }}</div>
              </td>
              <td class="px-3 py-3 text-slate-600">{{ r.class_name }}</td>
              <td class="px-3 py-3">
                <span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="(STATUS[r.status] || STATUS.lainnya).cls">
                  {{ (STATUS[r.status] || STATUS.lainnya).label }}
                </span>
              </td>
              <td class="px-5 py-3 text-xs capitalize text-slate-500">{{ r.source || '-' }}</td>
            </tr>

            <tr v-if="!pagedRows.length">
              <td colspan="6" class="px-5 py-10 text-center text-sm text-slate-400">
                Belum ada catatan absensi pada rentang ini.
              </td>
            </tr>
          </tbody>
        </table>

      </div>

      <!-- PAGINASI -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <span>
          {{ activeRows.length }} {{ tab === 'students' ? 'siswa' : 'catatan' }}
          <template v-if="tab === 'records' && report.truncated"> · menampilkan 3.000 catatan terbaru</template>
        </span>

        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
            :disabled="page <= 1"
            aria-label="Halaman sebelumnya"
            @click="page--"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <span class="font-semibold">Halaman {{ Math.min(page, pages) }} / {{ pages }}</span>
          <button
            class="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
            :disabled="page >= pages"
            aria-label="Halaman berikutnya"
            @click="page++"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <p class="text-xs text-slate-400">
      Hari efektif = jumlah tanggal yang punya catatan absensi pada rentang terpilih.
      "Belum tercatat" = hari efektif dikurangi hari siswa tersebut tercatat.
    </p>

  </div>
</template>
