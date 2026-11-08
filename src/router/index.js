import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from './guards'

const A = ['admin'], T = ['teacher'], S = ['student'], AT = ['admin', 'teacher']

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guestOnly: true },
      children: [
        { path: '', redirect: '/login' },
        { path: 'login', name: 'login', component: () => import('@/pages/auth/Login.vue'), meta: { title: 'Masuk', guestOnly: true } },
        { path: 'forgot-password', name: 'forgot-password', component: () => import('@/pages/auth/ForgotPassword.vue'), meta: { title: 'Lupa Kata Sandi', guestOnly: true } },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // Dasbor
        { path: 'admin', name: 'admin-dashboard', component: () => import('@/pages/dashboards/AdminDashboard.vue'), meta: { roles: A, title: 'Dasbor' } },
        { path: 'teacher', name: 'teacher-dashboard', component: () => import('@/pages/dashboards/TeacherDashboard.vue'), meta: { roles: T, title: 'Dasbor' } },
        { path: 'student', name: 'student-dashboard', component: () => import('@/pages/dashboards/StudentDashboard.vue'), meta: { roles: S, title: 'Dasbor Saya' } },

        // Halaman yang sudah jadi
        { path: 'students', name: 'students', component: () => import('@/pages/students/Students.vue'), meta: { roles: AT, title: 'Data Siswa' } },

        // Halaman yang belum dibuat (sementara Placeholder, izin akses sudah dijaga)
        { path: 'teachers', name: 'teachers', component: () => import('@/pages/teacher/Teachers.vue'), meta: { roles: A, title: 'Data Guru', phase: 3 } },
        { path: 'classes', name: 'classes', component: () => import('@/pages/class/ClassesView.vue'), meta: { roles: A, title: 'Data Kelas', phase: 3 } },
        { path: 'users', name: 'users', component: () => import('@/pages/UsersRolesView.vue'), meta: { roles: A, title: 'Pengguna & Peran', phase: 3 } },
  { path: 'codes', name: 'codes', component: () => import('@/pages/codes/Codes.vue'), meta: { roles: A, title: 'Cetak Barcode & QR' } },
{ path: 'scan', name: 'scan', component: () => import('@/pages/scan/Scan.vue'), meta: { roles: AT, title: 'Pindai Absensi' } },
        { path: 'attendance', name: 'attendance', component: () => import('@/pages/Recap/RecapView.vue'), meta: { roles: AT, title: 'Rekap Absensi', phase: 5 } },
        { path: 'calendar', name: 'calendar', component: () => import('@/pages/AttendanceCalendarView.vue'), meta: { roles: ['admin', 'teacher', 'student'], title: 'Kalender Absensi', phase: 5 } },
        { path: 'reports', name: 'reports', component: () => import('@/pages/AttendanceReportView.vue'), meta: { roles: AT, title: 'Laporan', phase: 6 } },
        { path: 'settings', name: 'settings', component: () => import('@/pages/SchoolSettingsView.vue'), meta: { roles: A, title: 'Pengaturan Sekolah', phase: 3 } },
        { path: 'profile', name: 'profile', component: () => import('@/pages/ProfilView.vue'), meta: { title: 'Profil Saya', phase: 3 } },

        { path: 'change-password', name: 'change-password', component: () => import('@/pages/ChangePassword.vue'), meta: { title: 'Ubah Kata Sandi' } },
        { path: 'unauthorized', name: 'unauthorized', component: () => import('@/pages/Unauthorized.vue'), meta: { title: 'Tidak Diizinkan' } },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFound.vue'), meta: { title: 'Halaman Tidak Ditemukan' } },
  ],
})

installGuards(router)
router.afterEach((to) => {
  document.title = `${to.meta.title ? to.meta.title + ' · ' : ''}Absensi Sekolah Dasar`
})

export default router