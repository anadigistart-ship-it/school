const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'ssa.token'

/**
 * Pemanggil umum ke Apps Script.
 * - Content-Type text/plain menghindari preflight CORS.
 * - Token dikirim otomatis kecuali aksi bersifat publik (login, reset kata sandi).
 */
async function panggilApi(action, payload = {}, { publik = false } = {}) {
  if (!API_URL) {
    throw new Error('VITE_API_URL belum diatur di file .env')
  }

  const body = { action, payload }
  if (!publik) {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) body.token = token
  }

  let response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.error(`Permintaan "${action}" gagal:`, error)
    throw new Error(
      'Tidak dapat menghubungi Google Apps Script. Periksa koneksi dan deployment.'
    )
  }

  let hasil
  try {
    hasil = await response.json()
  } catch {
    throw new Error(
      `Server tidak mengembalikan JSON yang valid (HTTP ${response.status}).`
    )
  }

  if (!response.ok || !hasil.ok) {
    // Sesi habis: hapus token lama supaya pengguna diarahkan masuk ulang.
    if (hasil?.error?.code === 'UNAUTHENTICATED') {
      localStorage.removeItem(TOKEN_KEY)
    }
    const err = new Error(hasil?.error?.message || `Permintaan gagal (${response.status}).`)
    err.code = hasil?.error?.code
    throw err
  }

  return hasil.data
}

async function kirimLogin(identifier, password) {
  const data = await panggilApi('login', { identifier, password }, { publik: true })

  if (!data?.token) {
    console.error('Respons login:', data)
    throw new Error('Token login tidak ditemukan dalam respons server.')
  }

  localStorage.setItem(TOKEN_KEY, data.token)
  return data
}

async function keluar() {
  try {
    await panggilApi('logout')
  } finally {
    // Token selalu dihapus, meskipun permintaan ke server gagal.
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const authApi = {
  login: kirimLogin,
  logout: keluar,
  me: () => panggilApi('me'),
  changePassword: (currentPassword, newPassword) =>
    panggilApi('changePassword', { currentPassword, newPassword }),
  requestPasswordReset: (identifier) =>
    panggilApi('requestPasswordReset', { identifier }, { publik: true }),
}

export default authApi