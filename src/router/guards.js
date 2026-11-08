import { useAuthStore } from '@/stores/auth'

export function installGuards(router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    await auth.restore()

    const needsAuth = to.matched.some((r) => r.meta.requiresAuth)
    const guestOnly = to.matched.some((r) => r.meta.guestOnly)
    const roles = to.matched.flatMap((r) => r.meta.roles || [])

    if (needsAuth && !auth.isAuthenticated) {
      return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
    }
    if (guestOnly && auth.isAuthenticated) return auth.homePath
    if (roles.length && !roles.includes(auth.role)) return { name: 'unauthorized' }
    if (to.path === '/' && auth.isAuthenticated) return auth.homePath
  })
}
