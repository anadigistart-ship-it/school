import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { HOME_BY_ROLE, SESSION_KEY } from '@/config'

// Only the opaque session token is persisted. The user/role always come from the server,
// so editing localStorage cannot grant privileges.
export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(SESSION_KEY) || null)
  const user = ref(null)
  const ready = ref(false) // session restore attempted
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const role = computed(() => user.value?.role || null)
  const homePath = computed(() => HOME_BY_ROLE[role.value] || '/login')

  function setToken(t) {
    token.value = t
    if (t) localStorage.setItem(SESSION_KEY, t)
    else localStorage.removeItem(SESSION_KEY)
  }

  async function login(identifier, password) {
    loading.value = true
    try {
      const data = await authApi.login(identifier, password)
      setToken(data.token)
      user.value = data.user
      ready.value = true
      return data.user
    } finally {
      loading.value = false
    }
  }

  // Re-validates the stored token with the server.
  async function restore() {
    if (ready.value) return
    if (!token.value) { ready.value = true; return }
    try {
      const data = await authApi.me(token.value)
      user.value = data.user
    } catch (e) {
      if (['UNAUTHENTICATED', 'FORBIDDEN'].includes(e.code)) { setToken(null); user.value = null }
      else if (e.code === 'NETWORK') { /* keep token, user stays null -> login page shows retry */ }
      else { setToken(null); user.value = null }
    } finally {
      ready.value = true
    }
  }

  async function logout() {
    const t = token.value
    setToken(null)
    user.value = null
    try { if (t) await authApi.logout(t) } catch { /* token already cleared locally */ }
  }

  async function changePassword(currentPassword, newPassword) {
    await authApi.changePassword(token.value, currentPassword, newPassword)
  }

  function clearSession() { setToken(null); user.value = null }

  return { token, user, ready, loading, isAuthenticated, role, homePath, login, restore, logout, changePassword, clearSession }
})
