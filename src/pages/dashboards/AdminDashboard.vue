
<script setup>

import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ambilDataDashboard } from '@/services/dashboard'
import {
  Users,
  UserSquare2,
  School,
  ScanLine,
  QrCode,
  BarChart3,
  Settings,
  UserCheck,
  UserX,
  Clock3,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-vue-next'
const actions = [
  { label: 'Pindai Absensi', to: '/scan', icon: ScanLine },
  { label: 'Kelola Siswa', to: '/students', icon: Users },
  { label: 'Kelola Guru', to: '/teachers', icon: UserSquare2 },
  { label: 'Kelola Kelas', to: '/classes', icon: School },
  { label: 'Buat Kode Siswa', to: '/codes', icon: QrCode },
  { label: 'Laporan Absensi', to: '/reports', icon: BarChart3 },
  { label: 'Pengaturan Sekolah', to: '/settings', icon: Settings },
]
const auth = useAuthStore()

const dashboard = ref(null)
const loading = ref(false)
const errorMessage = ref('')

const statistik = computed(() => dashboard.value?.stats || {})
const ringkasanKelas = computed(
  () => dashboard.value?.class_summaries || []
)
const aktivitasTerbaru = computed(
  () => dashboard.value?.recent_attendance || []
)

const namaSekolah = computed(
  () => dashboard.value?.school?.name || 'Sekolah Dasar'
)

const tingkatKehadiran = computed(
  () => statistik.value.attendance_rate || 0
)

function ambilTokenSesi() {
  // Utamakan token dari store autentikasi.
  // Sesuaikan nama properti jika auth store kamu memakai nama berbeda.
  return (
    auth.token ||
    auth.sessionToken ||
    localStorage.getItem('token') ||
    localStorage.getItem('sessionToken') ||
    ''
  )
}

async function muatDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = ambilTokenSesi()
    dashboard.value = await ambilDataDashboard(token)
  } catch (error) {
    errorMessage.value =
      error.message || 'Tidak bisa memuat data dashboard.'
  } finally {
    loading.value = false
  }
}

function formatAngka(nilai) {
  return Number(nilai || 0).toLocaleString('id-ID')
}

function formatWaktu(nilai) {
  if (!nilai) return '-'
  return String(nilai).slice(0, 8)
}

onMounted(muatDashboard)
</script>


<template>
  <div class="mx-auto max-w-7xl space-y-6 pb-10">
    <!-- JUDUL DASHBOARD -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p class="text-sm text-slate-500">
          {{ namaSekolah }}
          <span v-if="dashboard?.school?.academic_year">
            · Tahun ajaran {{ dashboard.school.academic_year }}
          </span>
        </p>

        <h1 class="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          Selamat datang, {{ auth.user?.full_name || 'Administrator' }}!
        </h1>

        <p class="mt-2 text-sm text-slate-500">
          Pantau kehadiran siswa dan aktivitas sekolah hari ini.
        </p>
      </div>

      <button
        type="button"
        @click="muatDashboard"
        :disabled="loading"
        class="inline-flex items-center justify-center gap-2 rounded-xl
               bg-[#10264d] px-4 py-3 text-sm font-semibold text-white
               transition hover:bg-[#2452cf] disabled:opacity-60"
      >
        <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        {{ loading ? 'Memuat data...' : 'Segarkan Data' }}
      </button>
    </header>

    <!-- PESAN KESALAHAN -->
    <div
      v-if="errorMessage"
      class="flex items-start gap-3 rounded-xl border border-rose-200
             bg-rose-50 p-4 text-sm text-rose-700"
    >
      <AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="font-semibold">Data dashboard gagal dimuat</p>
        <p class="mt-1">{{ errorMessage }}</p>
        <button
          type="button"
          @click="muatDashboard"
          class="mt-2 font-semibold underline"
        >
          Coba lagi
        </button>
      </div>
    </div>

    <!-- KARTU STATISTIK -->
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="kartu in [
          {
            judul: 'Total Siswa',
            nilai: statistik.total_students,
            keterangan: 'Siswa aktif terdaftar',
            ikon: Users,
            warna: 'bg-blue-50 text-blue-700',
          },
          {
            judul: 'Hadir Hari Ini',
            nilai: statistik.present_today,
            keterangan: 'Siswa hadir tepat waktu',
            ikon: UserCheck,
            warna: 'bg-emerald-50 text-emerald-700',
          },
          {
            judul: 'Terlambat',
            nilai: statistik.late_today,
            keterangan: 'Siswa datang terlambat',
            ikon: Clock3,
            warna: 'bg-amber-50 text-amber-700',
          },
          {
            judul: 'Belum Tercatat',
            nilai: statistik.unrecorded_today,
            keterangan: 'Belum memiliki catatan absensi',
            ikon: UserX,
            warna: 'bg-rose-50 text-rose-700',
          },
        ]"
        :key="kartu.judul"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm
               transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-500">
              {{ kartu.judul }}
            </p>
            <p class="mt-3 text-3xl font-bold text-slate-900">
              {{ formatAngka(kartu.nilai) }}
            </p>
          </div>

          <div :class="['grid h-11 w-11 place-items-center rounded-xl', kartu.warna]">
            <component :is="kartu.ikon" class="h-5 w-5" />
          </div>
        </div>

        <p class="mt-4 text-xs text-slate-500">
          {{ kartu.keterangan }}
        </p>
      </article>
    </section>

    <!-- RINGKASAN KEHADIRAN -->
    <section class="grid gap-5 lg:grid-cols-3">
      <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-bold text-slate-900">Ringkasan Kehadiran</h2>
        <p class="mt-1 text-sm text-slate-500">Status absensi hari ini</p>

        <div class="mt-6">
          <div class="flex items-end gap-2">
            <span class="text-4xl font-bold text-[#10264d]">
              {{ statistik.attendance_rate || 0 }}%
            </span>
            <span class="mb-1 text-sm text-slate-500">tingkat kehadiran</span>
          </div>

          <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-400"
              :style="{
                width: `${Math.min(statistik.attendance_rate || 0, 100)}%`
              }"
            />
          </div>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="status in [
              {
                nama: 'Hadir',
                jumlah: statistik.present_today,
                warna: 'bg-emerald-500',
              },
              {
                nama: 'Terlambat',
                jumlah: statistik.late_today,
                warna: 'bg-amber-500',
              },
              {
                nama: 'Tidak Hadir',
                jumlah: statistik.absent_today,
                warna: 'bg-rose-500',
              },
              {
                nama: 'Izin / Sakit',
                jumlah: statistik.excused_today,
                warna: 'bg-blue-500',
              },
            ]"
            :key="status.nama"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <span class="flex items-center gap-2 text-slate-600">
              <span :class="['h-2.5 w-2.5 rounded-full', status.warna]" />
              {{ status.nama }}
            </span>
            <span class="font-bold text-slate-800">
              {{ formatAngka(status.jumlah) }}
            </span>
          </div>
        </div>
      </article>

      <!-- RINGKASAN KELAS -->
      <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-bold text-slate-900">Kehadiran per Kelas</h2>
            <p class="mt-1 text-sm text-slate-500">
              Ringkasan siswa yang sudah hadir
            </p>
          </div>
          <School class="h-5 w-5 text-slate-400" />
        </div>

        <div v-if="ringkasanKelas.length" class="mt-5 space-y-5">
          <div
            v-for="kelas in ringkasanKelas"
            :key="kelas.class_id"
          >
            <div class="mb-2 flex items-center justify-between gap-3">
              <span class="text-sm font-semibold text-slate-700">
                {{ kelas.class_name }}
              </span>
              <span class="text-xs font-semibold text-slate-500">
                {{ kelas.attendance_rate }}%
                · {{ kelas.present + kelas.late }}/{{ kelas.total_students }} siswa
              </span>
            </div>

            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-400"
                :style="{ width: `${kelas.attendance_rate}%` }"
              />
            </div>
          </div>
        </div>

        <div v-else class="py-10 text-center text-sm text-slate-500">
          Belum ada data kelas untuk ditampilkan.
        </div>
      </article>
    </section>

    <!-- MENU CEPAT -->
    <section>
      <h2 class="text-lg font-bold text-slate-900">Akses Cepat</h2>
      <p class="mt-1 text-sm text-slate-500">
        Pilih menu yang ingin kamu kelola.
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RouterLink
          v-for="menu in actions"
          :key="menu.to"
          :to="menu.to"
          class="group flex items-center gap-3 rounded-2xl border
                 border-slate-200 bg-white p-4 shadow-sm transition
                 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        >
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-xl
                   bg-blue-50 text-blue-700 transition
                   group-hover:bg-[#2452cf] group-hover:text-white"
          >
            <component :is="menu.icon" class="h-5 w-5" />
          </span>
          <span class="text-sm font-semibold text-slate-800">
            {{ menu.label }}
          </span>
        </RouterLink>
      </div>
    </section>

    <!-- AKTIVITAS ABSENSI -->
    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 class="font-bold text-slate-900">Aktivitas Absensi Terbaru</h2>
          <p class="mt-1 text-sm text-slate-500">
            Catatan absensi yang masuk hari ini
          </p>
        </div>
        <RouterLink
          to="/reports"
          class="text-sm font-semibold text-blue-700 hover:underline"
        >
          Lihat laporan
        </RouterLink>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[600px] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-3 font-semibold">Nama Siswa</th>
              <th class="px-4 py-3 font-semibold">Kelas</th>
              <th class="px-4 py-3 font-semibold">Waktu</th>
              <th class="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="item in aktivitasTerbaru"
              :key="item.attendance_id"
              class="hover:bg-slate-50"
            >
              <td class="px-5 py-4">
                <p class="font-semibold text-slate-800">
                  {{ item.student_name }}
                </p>
                <p class="mt-1 text-xs text-slate-400">
                  {{ item.student_id }}
                </p>
              </td>

              <td class="px-4 py-4 text-slate-600">
                {{ item.class_name }}
              </td>

              <td class="px-4 py-4 font-medium text-slate-700">
                {{ formatWaktu(item.check_in_time) }}
              </td>

              <td class="px-5 py-4">
                <span
                  :class="[
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                    ['terlambat', 'late'].includes(
                      String(item.attendance_status || '').toLowerCase()
                    )
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  ]"
                >
                  {{ item.attendance_status || 'Belum diketahui' }}
                </span>
              </td>
            </tr>

            <tr v-if="!aktivitasTerbaru.length">
              <td colspan="4" class="px-5 py-10 text-center text-slate-500">
                Belum ada aktivitas absensi hari ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- INFORMASI PEMBARUAN -->
    <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400">
      <span class="flex items-center gap-2">
        <CheckCircle2 class="h-4 w-4 text-emerald-500" />
        Terhubung melalui Google Apps Script
      </span>
      <span>
        Tanggal data: {{ dashboard?.date || '-' }}
      </span>
    </footer>
  </div>
</template>