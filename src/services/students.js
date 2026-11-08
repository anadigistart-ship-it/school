const API_URL = import.meta.env.VITE_API_URL

function ambilToken(token) {
return (
token ||
localStorage.getItem('ssa.token') ||
localStorage.getItem('token') ||
''
)
}

async function kirimPermintaan(action, token, payload = {}) {
if (!API_URL) {
throw new Error(
'URL Google Apps Script belum diatur di file .env'
)
}

const tokenAktif = ambilToken(token)

if (!tokenAktif) {
throw new Error(
'Sesi masuk tidak ditemukan. Silakan masuk kembali.'
)
}

let response

try {
response = await fetch(API_URL, {
method: 'POST',
headers: {
'Content-Type': 'text/plain;charset=utf-8',
},
body: JSON.stringify({
action,
token: tokenAktif,
payload,
}),
})
} catch (error) {
throw new Error(
'Tidak dapat terhubung ke server. Periksa koneksi dan URL Google Apps Script.'
)
}

if (!response.ok) {
throw new Error(
`Gagal menghubungi server (${response.status}).`
)
}

const hasil = await response.json()

if (!hasil.ok) {
if (hasil.error?.code === 'UNAUTHENTICATED') {
throw new Error(
'Sesi masuk sudah berakhir. Silakan masuk kembali.'
)
}

```
throw new Error(
  hasil.error?.message || 'Permintaan data siswa gagal.'
)
```

}

return hasil.data
}

const studentsService = {
async list(token, params = {}) {
return kirimPermintaan('list', token, {
entity: 'students',
page: params.page || 1,
pageSize: params.pageSize || 10,
search: params.search || '',
sort: params.sort || 'full_name',
dir: params.dir || 'asc',
filters: params.filters || {},
})
},

async options(token) {
return kirimPermintaan('options', token, {})
},

async create(token, data) {
return kirimPermintaan('create', token, {
entity: 'students',
data,
})
},

async update(token, id, data) {
return kirimPermintaan('update', token, {
entity: 'students',
id,
data,
})
},

async remove(token, id) {
return kirimPermintaan('remove', token, {
entity: 'students',
id,
})
},
}

export default studentsService
