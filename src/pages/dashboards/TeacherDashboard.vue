<script setup>
/**
 * Dashboard Guru
 * Backend:
 *  - dashboard {}                          -> { school, date, updated_at, stats, class_summaries, recent_attendance }
 *  - attendanceRanking { month?, class_id? } -> { month, class_id, ranked, top[] }   (lihat AttendanceRanking.gs)
 * Data otomatis dibatasi ke kelas guru oleh backend.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ScanLine, ClipboardList, BarChart3, Users, Trophy, RefreshCw, School, CheckCircle2, UserX, Percent } from 'lucide-vue-next'
import { api } from '@/api/client.js'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const call = (action, payload = {}) => api(action, payload, auth.token)

const actions = [
  { label: 'Scan absensi', to: '/scan', icon: ScanLine },
  { label: 'Siswa saya', to: '/students', icon: Users },
  { label: 'Riwayat absensi', to: '/attendance', icon: ClipboardList },
  { label: 'Laporan kelas', to: '/reports', icon: BarChart3 },
]

// ---------- Sapaan ----------
const firstName = computed(() => (auth.user?.full_name || 'Guru').split(/\s+/)[0])
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'
})
const parse = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const fmtLong = (key) => parse(key).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtTime = (t) => String(t || '').slice(0, 5)
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

// ---------- Dashboard ----------
const data = ref(null)
const loading = ref(true)
const error = ref('')
const refreshing = ref(false)

async function loadDashboard(silent = false) {
  if (silent) refreshing.value = true
  else loading.value = true
  if (!silent) error.value = ''
  try {
    data.value = await call('dashboard')
    error.value = ''
  } catch (e) {
    if (!silent || !data.value) error.value = e?.message || 'Gagal memuat dashboard.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const stats = computed(() => data.value?.stats || {})
const classes = computed(() => data.value?.class_summaries || [])
const present = computed(() => (stats.value.present_today || 0) + (stats.value.late_today || 0))
const absentTotal = computed(() => (stats.value.absent_today || 0) + (stats.value.excused_today || 0))
const rate = computed(() => stats.value.attendance_rate || 0)
const rateBar = computed(() => (rate.value >= 90 ? 'bg-emerald-500' : rate.value >= 75 ? 'bg-amber-500' : 'bg-red-500'))
const classBar = (r) => (r >= 90 ? 'bg-emerald-500' : r >= 75 ? 'bg-amber-500' : 'bg-red-500')

const STATUS = {
  hadir: { label: 'Hadir', chip: 'bg-emerald-100 text-emerald-700' },
  terlambat: { label: 'Terlambat', chip: 'bg-amber-100 text-amber-700' },
  izin: { label: 'Izin', chip: 'bg-sky-100 text-sky-700' },
  sakit: { label: 'Sakit', chip: 'bg-violet-100 text-violet-700' },
  alpha: { label: 'Alpha', chip: 'bg-red-100 text-red-700' },
  lainnya: { label: 'Lainnya', chip: 'bg-slate-100 text-slate-600' },
}
function statusOf(v) {
  const s = String(v || '').toLowerCase().trim()
  if (['hadir', 'present', 'tepat waktu', 'on time'].includes(s)) return STATUS.hadir
  if (['terlambat', 'late'].includes(s)) return STATUS.terlambat
  if (['izin', 'permit', 'excused'].includes(s)) return STATUS.izin
  if (['sakit', 'sick'].includes(s)) return STATUS.sakit
  if (['alpha', 'alpa', 'absent', 'tidak hadir'].includes(s)) return STATUS.alpha
  return STATUS.lainnya
}

// ---------- Peringkat ----------
const ranking = ref(null)
const rankLoading = ref(true)
const rankError = ref('')
const rankClass = ref('')
const rankPeriod = ref('this') // this | last

function lastMonthKey() {
  const d = new Date()
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`
}

async function loadRanking() {
  rankLoading.value = true
  rankError.value = ''
  try {
    const payload = {}
    if (rankClass.value) payload.class_id = rankClass.value
    if (rankPeriod.value === 'last') payload.month = lastMonthKey()
    ranking.value = await call('attendanceRanking', payload)
  } catch (e) {
    rankError.value = e?.message || 'Gagal memuat peringkat.'
    ranking.value = null
  } finally {
    rankLoading.value = false
  }
}
watch([rankClass, rankPeriod], loadRanking)

const rankTitle = computed(() => {
  if (!ranking.value) return ''
  const [y, m] = ranking.value.month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const AVATAR = { 1: 'bg-amber-400', 2: 'bg-slate-400', 3: 'bg-orange-400' }
const PODIUM = { 1: 'bg-gradient-to-b from-amber-400 to-amber-500 min-h-[7rem]', 2: 'bg-gradient-to-b from-slate-400 to-slate-500 min-h-[5.5rem]', 3: 'bg-gradient-to-b from-orange-400 to-orange-500 min-h-[4.5rem]' }
// Urutan podium: juara 2 – juara 1 – juara 3
const podium = computed(() => {
  const t = ranking.value?.top || []
  return [t[1], t[0], t[2]].filter(Boolean)
})

// ---------- Siklus hidup ----------
let timer
onMounted(() => {
  loadDashboard()
  loadRanking()
  timer = setInterval(() => { if (!document.hidden) loadDashboard(true) }, 60000) // segarkan tiap 1 menit saat tab aktif
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <!-- Header -->
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-navy-900">{{ greeting }}, {{ firstName }}! 👋</h1>
        <p class="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
          <span v-if="data">{{ fmtLong(data.date) }}</span>
          <span v-if="data" class="text-slate-300">•</span>
          <span v-if="data" class="inline-flex items-center gap-1"><School class="h-4 w-4" /> {{ data.school.name }}</span>
          <span v-if="data" class="text-slate-300">•</span>
          <span v-if="data">{{ classes.length }} kelas</span>
        </p>
      </div>
      <button class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" :disabled="loading || refreshing" @click="loadDashboard(true)">
        <RefreshCw :class="['h-4 w-4', refreshing ? 'animate-spin' : '']" /> Segarkan
      </button>
    </header>

    <!-- Aksi cepat -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RouterLink v-for="a in actions" :key="a.to" :to="a.to" class="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-royal-500/40">
        <span class="grid h-10 w-10 place-items-center rounded-lg bg-navy-50 text-navy-700 group-hover:bg-royal-500 group-hover:text-white"><component :is="a.icon" class="h-5 w-5" /></span>
        <span class="text-sm font-semibold text-slate-800">{{ a.label }}</span>
      </RouterLink>
    </div>

    <!-- Error -->
    <div v-if="error && !data" class="card p-8 text-center">
      <p class="font-semibold text-slate-800">Dashboard belum bisa dimuat</p>
      <p class="mt-1 text-sm text-slate-500">{{ error }}</p>
      <button class="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90" @click="loadDashboard()"><RefreshCw class="h-4 w-4" /> Coba lagi</button>
    </div>

    <!-- Skeleton -->
    <template v-else-if="!data">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4"><div v-for="i in 4" :key="i" class="h-28 animate-pulse rounded-xl bg-slate-200" /></div>
      <div class="grid gap-5 lg:grid-cols-5"><div class="h-72 animate-pulse rounded-xl bg-slate-200 lg:col-span-3" /><div class="h-72 animate-pulse rounded-xl bg-slate-200 lg:col-span-2" /></div>
    </template>

    <template v-else>
      <!-- Belum punya kelas -->
      <div v-if="!classes.length" class="card p-8 text-center">
        <p class="font-semibold text-slate-800">Kamu belum terhubung ke kelas mana pun</p>
        <p class="mt-1 text-sm text-slate-500">Minta admin menetapkanmu sebagai wali kelas atau menambahkan kelas yang kamu ajar.</p>
      </div>

      <template v-else>
        <!-- Statistik hari ini -->
        <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="card p-5">
            <p class="flex items-center gap-2 text-sm font-semibold text-slate-500"><Users class="h-4 w-4" /> Total siswa</p>
            <p class="mt-2 text-3xl font-bold text-navy-900">{{ stats.total_students || 0 }}</p>
            <p class="text-xs text-slate-400">di {{ classes.length }} kelas</p>
          </div>
          <div class="card p-5">
            <p class="flex items-center gap-2 text-sm font-semibold text-slate-500"><CheckCircle2 class="h-4 w-4 text-emerald-500" /> Hadir hari ini</p>
            <p class="mt-2 text-3xl font-bold text-navy-900">{{ present }}</p>
            <p class="text-xs text-slate-400">termasuk {{ stats.late_today || 0 }} terlambat</p>
          </div>
          <div class="card p-5">
            <p class="flex items-center gap-2 text-sm font-semibold text-slate-500"><UserX class="h-4 w-4 text-amber-500" /> Belum tercatat</p>
            <p class="mt-2 text-3xl font-bold text-navy-900">{{ stats.unrecorded_today || 0 }}</p>
            <p class="text-xs text-slate-400">izin/sakit/alpha: {{ absentTotal }}</p>
          </div>
          <div class="card p-5">
            <p class="flex items-center gap-2 text-sm font-semibold text-slate-500"><Percent class="h-4 w-4 text-royal-500" /> Kehadiran</p>
            <p class="mt-2 text-3xl font-bold text-navy-900">{{ rate }}%</p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div :class="['h-full rounded-full transition-all', rateBar]" :style="{ width: rate + '%' }" /></div>
          </div>
        </section>

        <div class="grid gap-5 lg:grid-cols-5">
          <!-- Ringkasan kelas -->
          <section class="card p-5 lg:col-span-3">
            <h2 class="font-bold text-navy-900">Ringkasan per kelas</h2>
            <p class="text-xs text-slate-500">Kehadiran hari ini</p>
            <ul class="mt-4 space-y-4">
              <li v-for="c in classes" :key="c.class_id">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="truncate text-sm font-semibold text-slate-800">{{ c.class_name }}</p>
                  <p class="flex-none text-sm font-bold text-navy-900">{{ c.attendance_rate }}%</p>
                </div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div :class="['h-full rounded-full transition-all', classBar(c.attendance_rate)]" :style="{ width: c.attendance_rate + '%' }" /></div>
                <p class="mt-1 text-xs text-slate-500">{{ c.present + c.late }} dari {{ c.total_students }} siswa hadir<template v-if="c.late"> · {{ c.late }} terlambat</template></p>
              </li>
            </ul>
          </section>

          <!-- Peringkat -->
          <section class="card p-5 lg:col-span-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="flex items-center gap-2 font-bold text-navy-900"><Trophy class="h-5 w-5 text-amber-500" /> Top 3 kehadiran</h2>
                <p v-if="ranking" class="text-xs capitalize text-slate-500">{{ rankTitle }}</p>
              </div>
              <div class="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
                <button :class="['rounded-md px-2.5 py-1', rankPeriod === 'this' ? 'bg-navy-900 text-white' : 'text-slate-500']" @click="rankPeriod = 'this'">Bulan ini</button>
                <button :class="['rounded-md px-2.5 py-1', rankPeriod === 'last' ? 'bg-navy-900 text-white' : 'text-slate-500']" @click="rankPeriod = 'last'">Bulan lalu</button>
              </div>
            </div>

            <select v-if="classes.length > 1" v-model="rankClass" class="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" aria-label="Pilih kelas">
              <option value="">Semua kelas saya</option>
              <option v-for="c in classes" :key="c.class_id" :value="c.class_id">{{ c.class_name }}</option>
            </select>

            <div :class="rankLoading ? 'opacity-50' : ''" class="transition-opacity">
              <p v-if="rankError" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ rankError }} <button class="underline" @click="loadRanking">Coba lagi</button></p>
              <p v-else-if="ranking && !ranking.top.length" class="mt-6 text-center text-sm text-slate-500">Belum ada data absensi pada periode ini.</p>
              <div v-else-if="ranking" class="mt-5 flex items-end justify-center gap-3">
                <div v-for="p in podium" :key="p.student_id" class="flex w-1/3 max-w-[9rem] flex-col items-center text-center">
                  <span class="text-2xl leading-none">{{ MEDAL[p.rank] }}</span>
                  <div :class="['mt-1 grid place-items-center rounded-full font-bold text-white', AVATAR[p.rank], p.rank === 1 ? 'h-16 w-16 text-lg' : 'h-12 w-12 text-sm']">{{ initials(p.full_name) }}</div>
                  <p class="mt-2 w-full truncate text-sm font-semibold text-slate-800" :title="p.full_name">{{ p.full_name }}</p>
                  <p class="w-full truncate text-xs text-slate-500">{{ p.class_name }}</p>
                  <div :class="['mt-2 flex w-full flex-col items-center justify-center rounded-t-xl px-2 py-3 text-white', PODIUM[p.rank]]">
                    <p class="text-xl font-bold">{{ p.rate }}%</p>
                    <p class="text-[11px] opacity-90">{{ p.hadir }} hadir · {{ p.terlambat }} telat</p>
                  </div>
                </div>
              </div>
            </div>
            <p v-if="ranking && ranking.top.length" class="mt-3 text-[11px] text-slate-400">Dari {{ ranking.ranked }} siswa. Diurutkan dari persentase hadir tertinggi, lalu paling sedikit terlambat.</p>
          </section>
        </div>

        <!-- Absensi terbaru -->
        <section class="card p-5">
          <h2 class="font-bold text-navy-900">Absensi terbaru hari ini</h2>
          <p v-if="!data.recent_attendance.length" class="mt-3 text-sm text-slate-500">Belum ada siswa yang dipindai hari ini.</p>
          <ul v-else class="mt-3 divide-y divide-slate-100">
            <li v-for="r in data.recent_attendance" :key="r.attendance_id" class="flex items-center justify-between gap-3 py-2.5">
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid h-9 w-9 flex-none place-items-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{{ initials(r.student_name) }}</span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-800">{{ r.student_name }}</p>
                  <p class="text-xs text-slate-500">{{ r.class_name }} · {{ fmtTime(r.check_in_time) || '--:--' }}</p>
                </div>
              </div>
              <span :class="['flex-none rounded-full px-2.5 py-1 text-xs font-semibold', statusOf(r.attendance_status).chip]">{{ statusOf(r.attendance_status).label }}</span>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
