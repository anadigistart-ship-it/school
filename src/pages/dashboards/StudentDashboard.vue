<script setup>
/**
 * Dashboard Siswa (read-only)
 * Backend: studentDashboard { month? } -> { school, student, today, month, streak, recent, upcoming_holidays }
 * (lihat StudentPortal.gs)
 */
import { ref, computed, onMounted } from 'vue'
import {
  CheckCircle2, Clock, XCircle, CalendarOff, Flame, IdCard, ChevronLeft, ChevronRight,
  HeartPulse, FileText, CalendarDays, RefreshCw, School,
} from 'lucide-vue-next'
import { api } from '@/api/client.js'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// ---------- Data ----------
const data = ref(null)
const loading = ref(true)
const error = ref('')
const errorCode = ref('')

async function load(month) {
  loading.value = true
  error.value = ''
  errorCode.value = ''
  try {
    data.value = await api('studentDashboard', month ? { month } : {}, auth.token)
  } catch (e) {
    error.value = e?.message || 'Gagal memuat dashboard.'
    errorCode.value = e?.code || ''
  } finally {
    loading.value = false
  }
}
onMounted(() => load())

// ---------- Tampilan status ----------
const META = {
  hadir:     { label: 'Hadir',          short: 'H', icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700', cell: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  terlambat: { label: 'Terlambat',      short: 'T', icon: Clock,        chip: 'bg-amber-100 text-amber-700',     cell: 'bg-amber-50 text-amber-800 border-amber-200',       dot: 'bg-amber-500' },
  izin:      { label: 'Izin',           short: 'I', icon: FileText,     chip: 'bg-sky-100 text-sky-700',         cell: 'bg-sky-50 text-sky-800 border-sky-200',             dot: 'bg-sky-500' },
  sakit:     { label: 'Sakit',          short: 'S', icon: HeartPulse,   chip: 'bg-violet-100 text-violet-700',   cell: 'bg-violet-50 text-violet-800 border-violet-200',    dot: 'bg-violet-500' },
  alpha:     { label: 'Alpha',          short: 'A', icon: XCircle,      chip: 'bg-red-100 text-red-700',         cell: 'bg-red-50 text-red-800 border-red-200',             dot: 'bg-red-500' },
  kosong:    { label: 'Tidak tercatat', short: '–', icon: XCircle,      chip: 'bg-slate-100 text-slate-600',     cell: 'bg-slate-100 text-slate-500 border-slate-200',      dot: 'bg-slate-400' },
  belum:     { label: 'Belum absen',    short: '…', icon: Clock,        chip: 'bg-slate-100 text-slate-600',     cell: 'bg-white text-slate-500 border-slate-200',          dot: 'bg-slate-300' },
  lainnya:   { label: 'Lainnya',        short: '?', icon: FileText,     chip: 'bg-slate-100 text-slate-600',     cell: 'bg-slate-100 text-slate-500 border-slate-200',      dot: 'bg-slate-400' },
}
const metaOf = (s) => META[s] || META.lainnya

// ---------- Format tanggal ----------
const parse = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const fmtLong = (key) => parse(key).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtShort = (key) => parse(key).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = (t) => String(t || '').slice(0, 5)

// ---------- Hero & status hari ini ----------
const firstName = computed(() => (data.value?.student.full_name || auth.user?.full_name || '').split(/\s+/)[0] || 'Siswa')
const initials = computed(() =>
  (data.value?.student.full_name || auth.user?.full_name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
)

const todayView = computed(() => {
  const t = data.value?.today
  if (!t) return null
  if (t.holiday) return { icon: CalendarOff, title: 'Hari ini libur', sub: t.holiday }
  if (t.status) {
    const m = metaOf(t.status)
    const sub = t.check_in_time ? `Tercatat pukul ${fmtTime(t.check_in_time)}` : 'Tercatat oleh sekolah'
    const title = { hadir: 'Kamu sudah hadir', terlambat: 'Kamu tercatat terlambat' }[t.status] || `Status hari ini: ${m.label}`
    return { icon: m.icon, title, sub }
  }
  const s = data.value.school
  return { icon: Clock, title: 'Belum absen hari ini', sub: `Jam masuk ${s.start_time} · batas terlambat ${s.late_threshold}` }
})

// ---------- Ringkasan bulan ----------
const sum = computed(() => data.value?.month.summary || { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0, kosong: 0, rate: 0 })
const absentTotal = computed(() => sum.value.izin + sum.value.sakit + sum.value.alpha + sum.value.kosong)
const rateStroke = computed(() => (sum.value.rate >= 90 ? 'stroke-emerald-500' : sum.value.rate >= 75 ? 'stroke-amber-500' : 'stroke-red-500'))
const rateText = computed(() => (sum.value.rate >= 90 ? 'Luar biasa! Pertahankan ya.' : sum.value.rate >= 75 ? 'Cukup baik, yuk lebih rajin.' : 'Ayo tingkatkan kehadiranmu.'))
const CIRC = 2 * Math.PI * 28
const dash = computed(() => `${(sum.value.rate / 100) * CIRC} ${CIRC}`)

// ---------- Kalender mini ----------
const monthKey = computed(() => data.value?.month.key || '')
const monthTitle = computed(() => {
  if (!monthKey.value) return ''
  const [y, m] = monthKey.value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})
const isCurrentMonth = computed(() => !!data.value && monthKey.value === data.value.today.date.slice(0, 7))

function shift(delta) {
  const [y, m] = monthKey.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (key > data.value.today.date.slice(0, 7)) return
  load(key)
}

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const HOL_STYLE = { background: 'repeating-linear-gradient(135deg,#fef2f2,#fef2f2 5px,#fee2e2 5px,#fee2e2 10px)' }

const cells = computed(() => {
  if (!data.value) return []
  const [y, m] = monthKey.value.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const total = new Date(y, m, 0).getDate()
  const byDay = Object.fromEntries(data.value.month.days.map((d) => [d.date, d]))
  const hols = Object.fromEntries(data.value.month.holidays.map((h) => [h.date, h]))
  const out = []
  for (let i = 0; i < lead; i++) out.push(null)
  for (let d = 1; d <= total; d++) {
    const date = `${monthKey.value}-${String(d).padStart(2, '0')}`
    const rec = byDay[date]
    const hol = hols[date]
    const weekend = (lead + d - 1) % 7 >= 5
    const status = rec?.status || null
    let title = ''
    if (hol) title = `Libur: ${hol.name}`
    else if (rec) title = `${metaOf(status).label}${rec.check_in_time ? ' · ' + fmtTime(rec.check_in_time) : ''}`
    out.push({ day: d, date, rec, hol, weekend, status, isToday: date === data.value.today.date, title })
  }
  return out
})

function cellClass(c) {
  if (c.rec && !(c.hol && !c.rec)) return metaOf(c.status).cell
  if (c.hol) return 'border-red-200 text-red-700'
  return c.weekend ? 'border-transparent bg-slate-50 text-slate-300' : 'border-slate-100 text-slate-400'
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <!-- Error / belum terhubung -->
    <div v-if="error && !data" class="card p-8 text-center">
      <p class="text-base font-semibold text-slate-800">
        {{ errorCode === 'NOT_FOUND' ? 'Akunmu belum terhubung ke data siswa' : 'Dashboard belum bisa dimuat' }}
      </p>
      <p class="mt-1 text-sm text-slate-500">{{ error }}</p>
      <button v-if="errorCode !== 'NOT_FOUND'" class="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90" @click="load()">
        <RefreshCw class="h-4 w-4" /> Coba lagi
      </button>
    </div>

    <!-- Skeleton -->
    <template v-else-if="!data">
      <div class="h-48 animate-pulse rounded-2xl bg-slate-200" />
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-28 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div class="h-80 animate-pulse rounded-xl bg-slate-200" />
    </template>

    <template v-else>
      <!-- Hero -->
      <section class="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-royal-500 p-5 text-white shadow-lg sm:p-7">
        <div class="flex items-center gap-4">
          <img v-if="data.student.photo_url" :src="data.student.photo_url" alt="" class="h-16 w-16 flex-none rounded-full border-2 border-white/40 object-cover" />
          <div v-else class="grid h-16 w-16 flex-none place-items-center rounded-full border-2 border-white/30 bg-white/15 text-xl font-bold">{{ initials }}</div>
          <div class="min-w-0">
            <p class="text-sm text-white/70">{{ fmtLong(data.today.date) }}</p>
            <h1 class="truncate text-2xl font-bold sm:text-3xl">Halo, {{ firstName }}! 👋</h1>
            <p class="mt-0.5 flex items-center gap-1.5 truncate text-sm text-white/80">
              <School class="h-4 w-4 flex-none" /> {{ data.student.class_name }} · {{ data.school.name }}
            </p>
          </div>
        </div>

        <div v-if="todayView" class="mt-5 flex items-center gap-3 rounded-xl bg-white/15 p-4 backdrop-blur">
          <span class="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/20"><component :is="todayView.icon" class="h-6 w-6" /></span>
          <div class="min-w-0">
            <p class="font-semibold">{{ todayView.title }}</p>
            <p class="truncate text-sm text-white/80">{{ todayView.sub }}</p>
          </div>
        </div>
      </section>

      <!-- Statistik bulan -->
      <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="card col-span-2 flex items-center gap-4 p-5 lg:col-span-1">
          <svg viewBox="0 0 72 72" class="h-[72px] w-[72px] flex-none -rotate-90" aria-hidden="true">
            <circle cx="36" cy="36" r="28" fill="none" stroke-width="8" class="stroke-slate-100" />
            <circle cx="36" cy="36" r="28" fill="none" stroke-width="8" stroke-linecap="round" :class="rateStroke" :stroke-dasharray="dash" />
          </svg>
          <div>
            <p class="text-3xl font-bold text-navy-900">{{ sum.rate }}%</p>
            <p class="text-xs font-semibold text-slate-500">Kehadiran bulan ini</p>
          </div>
        </div>
        <div class="card p-5">
          <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><span class="h-2 w-2 rounded-full bg-emerald-500" /> Hadir</p>
          <p class="mt-2 text-3xl font-bold text-navy-900">{{ sum.hadir }}</p>
          <p class="text-xs text-slate-400">dari {{ data.month.effective_days }} hari sekolah</p>
        </div>
        <div class="card p-5">
          <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><span class="h-2 w-2 rounded-full bg-amber-500" /> Terlambat</p>
          <p class="mt-2 text-3xl font-bold text-navy-900">{{ sum.terlambat }}</p>
          <p class="text-xs text-slate-400">kali bulan ini</p>
        </div>
        <div class="card p-5">
          <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><span class="h-2 w-2 rounded-full bg-red-500" /> Tidak hadir</p>
          <p class="mt-2 text-3xl font-bold text-navy-900">{{ absentTotal }}</p>
          <p class="text-xs text-slate-400">I {{ sum.izin }} · S {{ sum.sakit }} · A {{ sum.alpha }}<template v-if="sum.kosong"> · – {{ sum.kosong }}</template></p>
        </div>
      </section>
      <p class="-mt-2 px-1 text-sm text-slate-500">{{ rateText }}</p>

      <div class="grid gap-5 lg:grid-cols-3">
        <!-- Kalender -->
        <section class="card p-5 lg:col-span-2">
          <div class="flex items-center justify-between">
            <h2 class="flex items-center gap-2 font-bold capitalize text-navy-900"><CalendarDays class="h-5 w-5 text-royal-500" /> {{ monthTitle }}</h2>
            <div class="flex items-center gap-1">
              <button class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40" :disabled="loading" aria-label="Bulan sebelumnya" @click="shift(-1)"><ChevronLeft class="h-4 w-4" /></button>
              <button class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40" :disabled="loading || isCurrentMonth" aria-label="Bulan berikutnya" @click="shift(1)"><ChevronRight class="h-4 w-4" /></button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-400">
            <span v-for="h in HARI" :key="h">{{ h }}</span>
          </div>
          <div class="mt-1.5 grid grid-cols-7 gap-1.5 transition-opacity" :class="loading ? 'opacity-50' : ''">
            <template v-for="(c, i) in cells" :key="i">
              <div v-if="!c" />
              <div
                v-else
                :title="c.title"
                :style="c.hol && !c.rec ? HOL_STYLE : null"
                :class="['relative flex aspect-square flex-col justify-between rounded-lg border p-1 text-xs sm:p-1.5', cellClass(c)]"
              >
                <span :class="['font-semibold', c.isToday ? 'grid h-5 w-5 place-items-center rounded-full bg-royal-500 text-white' : '']">{{ c.day }}</span>
                <span v-if="c.rec" class="self-end text-[10px] font-bold sm:text-xs">{{ metaOf(c.status).short }}</span>
                <span v-else-if="c.hol" class="self-end text-[9px] font-semibold leading-none sm:text-[10px]">Libur</span>
              </div>
            </template>
          </div>

          <div class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span v-for="k in ['hadir', 'terlambat', 'izin', 'sakit', 'alpha', 'kosong']" :key="k" class="flex items-center gap-1.5">
              <span :class="['h-2.5 w-2.5 rounded-full', META[k].dot]" /> {{ META[k].label }}
            </span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-red-200" :style="HOL_STYLE" /> Libur</span>
          </div>
        </section>

        <!-- Kolom kanan -->
        <div class="space-y-5">
          <!-- Kartu siswa -->
          <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between bg-navy-900 px-4 py-2.5 text-white">
              <span class="flex items-center gap-2 text-xs font-bold tracking-wider"><IdCard class="h-4 w-4" /> KARTU SISWA</span>
              <span class="max-w-[55%] truncate text-xs text-white/70">{{ data.school.name }}</span>
            </div>
            <div class="p-4">
              <p class="text-lg font-bold leading-tight text-navy-900">{{ data.student.full_name }}</p>
              <dl class="mt-3 space-y-1.5 text-sm">
                <div class="flex justify-between gap-3"><dt class="text-slate-500">NIS</dt><dd class="font-semibold text-slate-800">{{ data.student.student_id }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-slate-500">Kelas</dt><dd class="font-semibold text-slate-800">{{ data.student.class_name }}</dd></div>
                <div v-if="data.student.homeroom_teacher" class="flex justify-between gap-3"><dt class="text-slate-500">Wali kelas</dt><dd class="truncate font-semibold text-slate-800">{{ data.student.homeroom_teacher }}</dd></div>
              </dl>
              <div class="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Kode absensi</p>
                <p class="font-mono text-base font-bold tracking-widest text-navy-900">{{ data.student.barcode_value }}</p>
              </div>
            </div>
          </section>

          <!-- Streak -->
          <section class="card flex items-center gap-4 p-5">
            <span class="grid h-12 w-12 flex-none place-items-center rounded-xl bg-orange-100 text-orange-500"><Flame class="h-6 w-6" /></span>
            <div>
              <p class="text-2xl font-bold text-navy-900">{{ data.streak }} <span class="text-sm font-semibold text-slate-500">hari</span></p>
              <p class="text-xs text-slate-500">{{ data.streak ? 'berturut-turut hadir. Jaga terus!' : 'Mulai lagi streak hadirmu hari ini.' }}</p>
            </div>
          </section>

          <!-- Libur mendatang -->
          <section v-if="data.upcoming_holidays.length" class="card p-5">
            <h2 class="flex items-center gap-2 text-sm font-bold text-navy-900"><CalendarOff class="h-4 w-4 text-red-500" /> Libur mendatang</h2>
            <ul class="mt-3 space-y-2">
              <li v-for="h in data.upcoming_holidays" :key="h.date" class="flex items-center justify-between gap-3 text-sm">
                <span class="truncate text-slate-700">{{ h.name }}</span>
                <span class="flex-none rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{{ fmtShort(h.date) }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <!-- Riwayat -->
      <section class="card p-5">
        <h2 class="font-bold text-navy-900">Riwayat terbaru</h2>
        <p v-if="!data.recent.length" class="mt-3 text-sm text-slate-500">Belum ada catatan absensi.</p>
        <ul v-else class="mt-3 divide-y divide-slate-100">
          <li v-for="r in data.recent" :key="r.date" class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-slate-800">{{ fmtLong(r.date) }}</p>
              <p class="text-xs text-slate-500">{{ r.check_in_time ? 'Pukul ' + fmtTime(r.check_in_time) : 'Dicatat oleh sekolah' }}</p>
            </div>
            <span :class="['inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', metaOf(r.status).chip]">
              <component :is="metaOf(r.status).icon" class="h-3.5 w-3.5" /> {{ metaOf(r.status).label }}
            </span>
          </li>
        </ul>
      </section>

      <p class="pb-2 text-center text-xs text-slate-400">Absensi hanya bisa dicatat oleh guru atau admin sekolah. Ada yang keliru? Hubungi wali kelas.</p>
    </template>
  </div>
</template>
