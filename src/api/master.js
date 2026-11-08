// src/api/master.js
// Pemanggil API umum untuk data master (guru, kelas, pengguna, dst.).
// Memakai token yang sama dengan authApi ('ssa.token').

const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'ssa.token'

async function panggil(action, payload = {}) {
  if (!API_URL) throw new Error('VITE_API_URL belum diatur di file .env')

  const body = { action, payload }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) body.token = token

  let response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet.')
  }

  let hasil
  try {
    hasil = await response.json()
  } catch {
    throw new Error(`Server tidak mengembalikan JSON yang valid (HTTP ${response.status}).`)
  }

  if (!hasil.ok) {
    if (hasil.error?.code === 'UNAUTHENTICATED') localStorage.removeItem(TOKEN_KEY)
    const err = new Error(hasil.error?.message || 'Permintaan gagal.')
    err.code = hasil.error?.code
    throw err
  }
  return hasil.data
}

export const masterApi = {
  // Daftar kelas (dan guru/siswa untuk admin) untuk dropdown.
  options: () => panggil('options'),

  // entity: 'teachers' | 'classes' | 'users' | 'students'
  list: (entity, { page = 1, pageSize = 10, search = '', filters = {}, sort, dir } = {}) =>
    panggil('list', { entity, page, pageSize, search, filters, sort, dir }),

  create: (entity, data) => panggil('create', { entity, data }),
  update: (entity, id, data) => panggil('update', { entity, id, data }),
  remove: (entity, id) => panggil('remove', { entity, id }),
}

export default masterApi
