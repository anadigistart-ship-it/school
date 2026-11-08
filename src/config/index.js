export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Smart School Attendance'
export const APP_MODE = import.meta.env.VITE_APP_MODE === 'production' ? 'production' : 'demo'
export const IS_DEMO = APP_MODE === 'demo'
export const API_URL = import.meta.env.VITE_API_URL || ''

export const ROLES = { ADMIN: 'admin', TEACHER: 'teacher', STUDENT: 'student' }

export const HOME_BY_ROLE = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
}

export const SESSION_KEY = 'ssa.session'
