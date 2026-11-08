// src/api/attendance.js
// Pemanggil API untuk fitur scan absensi dan cetak kartu.
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

export const attendanceApi = {
  // Catat absensi dari hasil scan. source: 'camera' | 'scanner'
  scan: (barcode, source = 'camera') => panggil('scan', { barcode, source }),

  // Daftar kelas untuk dropdown.
  options: () => panggil('options'),

  // Nama, logo, dan alamat sekolah (untuk kartu siswa).  ← TAMBAHKAN INI
  schoolInfo: () => panggil('schoolInfo'),

  // Semua siswa (opsional difilter per kelas).
  listStudents: (classId = '') =>
    panggil('list', {
      entity: 'students',
      all: true,
      filters: classId ? { class_id: classId, status: 'active' } : { status: 'active' },
    }),
}
export default attendanceApi
