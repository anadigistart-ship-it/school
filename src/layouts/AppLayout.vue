<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  GraduationCap, LayoutDashboard, Users, UserSquare2, School, QrCode, ScanLine, ClipboardList,
  CalendarDays, BarChart3, ShieldCheck, Settings, UserCircle, KeyRound, LogOut, Menu, X, Bell, ChevronRight, ChevronDown,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { APP_NAME } from '@/config'

const auth = useAuthStore()
const toast = useToastStore()
const route = useRoute()
const router = useRouter()

const open = ref(false)
const menu = ref(false)
const bell = ref(false)

const NAV = [
  { label: 'Dasbor', icon: LayoutDashboard, to: { admin: '/admin', teacher: '/teacher', student: '/student' } },
  { label: 'Pindai Absensi', icon: ScanLine, to: '/scan', roles: ['admin', 'teacher'] },
  { label: 'Siswa', icon: Users, to: '/students', roles: ['admin', 'teacher'] },
  { label: 'Guru', icon: UserSquare2, to: '/teachers', roles: ['admin'] },
  { label: 'Kelas', icon: School, to: '/classes', roles: ['admin'] },
  { label: 'Barcode & QR', icon: QrCode, to: '/codes', roles: ['admin'] },
  { label: 'Absensi', icon: ClipboardList, to: '/attendance', roles: ['admin', 'teacher'] },
  { label: 'Kalender', icon: CalendarDays, to: '/calendar' },
  { label: 'Laporan', icon: BarChart3, to: '/reports', roles: ['admin', 'teacher'] },
  { label: 'Pengguna & Peran', icon: ShieldCheck, to: '/users', roles: ['admin'] },
  { label: 'Pengaturan Sekolah', icon: Settings, to: '/settings', roles: ['admin'] },
]

const items = computed(() =>
  NAV.filter((n) => !n.roles || n.roles.includes(auth.role)).map((n) => ({
    ...n,
    path: typeof n.to === 'string' ? n.to : n.to[auth.role],
  })),
)

const crumbs = computed(() => {
  const dash = { label: 'Beranda', path: auth.homePath }
  if (route.path === auth.homePath) return [dash]
  return [dash, { label: route.meta.title || '', path: route.path }]
})

const initials = computed(() =>
  (auth.user?.full_name || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase(),
)

// Label peran untuk tampilan (nilai peran di data tetap bahasa Inggris).
const ROLE_LABEL = { admin: 'Admin', teacher: 'Guru', student: 'Siswa' }

watch(() => route.fullPath, () => { open.value = false; menu.value = false; bell.value = false })

async function logout() {
  await auth.logout()
  toast.info('Anda telah keluar.')
  router.replace('/login')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Lapisan gelap untuk mobile -->
    <div v-if="open" class="fixed inset-0 z-40 bg-navy-950/50 lg:hidden" @click="open = false"></div>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-navy-900 to-navy-800 text-white transition-transform lg:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
      aria-label="Navigasi utama"
    >
      <div class="flex h-16 items-center justify-between px-5">
        <div class="flex items-center gap-2.5">
          <div class="grid h-9 w-9 place-items-center rounded-lg bg-white/15"><GraduationCap class="h-5 w-5" /></div>
          <span class="text-sm font-semibold leading-tight">{{ APP_NAME }}</span>
        </div>
        <button class="rounded-md p-1.5 hover:bg-white/10 lg:hidden" aria-label="Tutup menu" @click="open = false"><X class="h-5 w-5" /></button>
      </div>
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <RouterLink
          v-for="n in items"
          :key="n.label"
          :to="n.path"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          active-class="!bg-white/15 !text-white"
        >
          <component :is="n.icon" class="h-4.5 w-4.5" />
          {{ n.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-white/10 p-3">
        <button class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-100 hover:bg-white/10" @click="logout">
          <LogOut class="h-4.5 w-4.5" /> Keluar
        </button>
      </div>
    </aside>

    <div class="lg:pl-64">
      <!-- Bilah atas -->
      <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Buka menu" @click="open = true"><Menu class="h-5 w-5" /></button>

        <nav class="hidden min-w-0 items-center gap-1.5 text-sm sm:flex" aria-label="Jejak halaman">
          <template v-for="(c, i) in crumbs" :key="c.path">
            <ChevronRight v-if="i" class="h-4 w-4 text-slate-400" />
            <RouterLink v-if="i < crumbs.length - 1" :to="c.path" class="text-slate-500 hover:text-slate-800">{{ c.label }}</RouterLink>
            <span v-else class="truncate font-semibold text-slate-800" aria-current="page">{{ c.label }}</span>
          </template>
        </nav>
        <span class="truncate text-sm font-semibold text-slate-800 sm:hidden">{{ route.meta.title }}</span>

        <div class="ml-auto flex items-center gap-1.5">
          <div class="relative">
            <button class="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifikasi" :aria-expanded="bell" @click="bell = !bell; menu = false">
              <Bell class="h-5 w-5" />
            </button>
            <div v-if="bell" class="card absolute right-0 mt-2 w-72 p-4 text-sm shadow-lg">
              <p class="font-semibold text-slate-800">Notifikasi</p>
              <p class="mt-2 text-slate-500">Tidak ada notifikasi baru.</p>
            </div>
          </div>

          <div class="relative">
            <button class="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-slate-100" :aria-expanded="menu" aria-haspopup="menu" @click="menu = !menu; bell = false">
              <span class="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-royal-500 to-navy-700 text-xs font-bold text-white">{{ initials }}</span>
              <span class="hidden text-left sm:block">
                <span class="block text-sm font-semibold leading-tight text-slate-800">{{ auth.user?.full_name }}</span>
                <span class="block text-xs text-slate-500">{{ ROLE_LABEL[auth.role] || auth.role }}</span>
              </span>
              <ChevronDown class="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
            <div v-if="menu" role="menu" class="card absolute right-0 mt-2 w-56 p-1.5 shadow-lg">
              <RouterLink to="/profile" role="menuitem" class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"><UserCircle class="h-4 w-4" /> Profil saya</RouterLink>
              <RouterLink to="/change-password" role="menuitem" class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"><KeyRound class="h-4 w-4" /> Ubah kata sandi</RouterLink>
              <hr class="my-1 border-slate-200" />
              <button role="menuitem" class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" @click="logout"><LogOut class="h-4 w-4" /> Keluar</button>
            </div>
          </div>
        </div>
      </header>

      <main class="p-4 sm:p-6 lg:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>