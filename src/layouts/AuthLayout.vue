<script setup>
import { GraduationCap, ScanLine, ShieldCheck, BarChart3 } from 'lucide-vue-next'
import { APP_NAME } from '@/config'

const points = [
  { icon: ScanLine, text: 'Pindai barcode atau QR code siswa dalam hitungan detik' },
  { icon: BarChart3, text: 'Dasbor dan laporan kehadiran secara langsung' },
  { icon: ShieldCheck, text: 'Akses berbasis peran, divalidasi di server' },
]
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <aside class="relative hidden overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-royal-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div class="flex items-center gap-3">
        <div class="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
          <GraduationCap class="h-6 w-6" />
        </div>
        <span class="text-lg font-semibold">{{ APP_NAME }}</span>
      </div>
      <div>
        <h2 class="max-w-md text-4xl font-bold leading-tight">Absensi tanpa repot administrasi.</h2>
        <ul class="mt-8 space-y-4">
          <li v-for="p in points" :key="p.text" class="flex items-center gap-3 text-navy-100">
            <span class="grid h-9 w-9 place-items-center rounded-lg bg-white/10"><component :is="p.icon" class="h-5 w-5" /></span>
            {{ p.text }}
          </li>
        </ul>
      </div>
      <p class="text-sm text-navy-200">Sistem manajemen kehadiran sekolah dasar</p>
      <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5"></div>
      <div class="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5"></div>
    </aside>

    <main class="flex items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <div class="grid h-10 w-10 place-items-center rounded-xl bg-navy-800 text-white"><GraduationCap class="h-5 w-5" /></div>
          <span class="font-semibold text-navy-900">{{ APP_NAME }}</span>
        </div>
        <RouterView />
      </div>
    </main>
  </div>
</template>