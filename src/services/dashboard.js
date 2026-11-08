
const API_URL = import.meta.env.VITE_API_URL

export async function ambilDataDashboard(token) {
  if (!API_URL) {
    throw new Error('URL Google Apps Script belum diatur di file .env')
  }

  if (!token) {
    throw new Error('Sesi masuk tidak ditemukan. Silakan masuk kembali.')
  }

  const response = await fetch(API_URL, {
    method: 'POST',

    // Menghindari preflight JSON khusus. Respons tetap harus bisa dibaca
    // oleh browser dari URL Web App yang sudah dipublikasikan.
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },

    body: JSON.stringify({
      action: 'dashboard',
      token,
      payload: {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Gagal menghubungi server (${response.status}).`)
  }

  const hasil = await response.json()

  if (!hasil.ok) {
    throw new Error(
      hasil.error?.message || 'Gagal mengambil data dashboard.'
    )
  }

  return hasil.data
}