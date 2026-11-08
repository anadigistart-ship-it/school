<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Plus, Search, Pencil, Trash2, X, AlertCircle, UserSquare2 } from 'lucide-vue-next'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { masterApi } from '@/api/master'
import { useToastStore } from '@/stores/toast'

const PAGE_SIZE = 10
const STATUS_LABEL = { active: 'Aktif', inactive: 'Nonaktif' }

const toast = useToastStore()

// ---------- Daftar ----------
const items = ref([])
const total = ref(0)
const page = ref(1)
const pages = ref(1)
const loading = ref(false)
const listError = ref('')
const search = ref('')
const statusFilter = ref('')
const classes = ref([])

let requestId = 0
let searchTimer = null

const classNameById = computed(() => {
  const map = {}
  classes.value.forEach((c) => { map[c.class_id] = c.class_name })
  return map
})

function classLabels(t) {
  return String(t.assigned_classes || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((id) => classNameById.value[id] || id)
}

async function load() {
  const myRequest = ++requestId
  loading.value = true
  listError.value = ''
  try {
    const data = await masterApi.list('teachers', {
      page: page.value,
      pageSize: PAGE_SIZE,
      search: search.value.trim(),
      filters: statusFilter.value ? { status: statusFilter.value } : {},
    })
    if (myRequest !== requestId) return // ada permintaan yang lebih baru
    items.value = data.items
    total.value = data.total
    pages.value = data.pages
    page.value = data.page
  } catch (e) {
    if (myRequest !== requestId) return
    listError.value = e.message
    items.value = []
    total.value = 0
  } finally {
    if (myRequest === requestId) loading.value = false
  }
}

function goTo(p) {
  if (p < 1 || p > pages.value || p === page.value) return
  page.value = p
  load()
}

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 300)
})
watch(statusFilter, () => { page.value = 1; load() })

const rangeText = computed(() => {
  if (!total.value) return ''
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, total.value)
  return `Menampilkan ${from}–${to} dari ${total.value} guru`
})

// ---------- Form tambah / ubah ----------
const showForm = ref(false)
const editingId = ref('')
const saving = ref(false)
const formError = ref('')
const form = reactive({ full_name: '', email: '', phone: '', status: 'active', assigned: [] })

function resetForm() {
  form.full_name = ''
  form.email = ''
  form.phone = ''
  form.status = 'active'
  form.assigned = []
  formError.value = ''
}

function openCreate() {
  editingId.value = ''
  resetForm()
  showForm.value = true
}

function openEdit(t) {
  editingId.value = t.teacher_id
  resetForm()
  form.full_name = t.full_name
  form.email = t.email
  form.phone = t.phone
  form.status = t.status || 'active'
  form.assigned = String(t.assigned_classes || '').split(',').map((x) => x.trim()).filter(Boolean)
  showForm.value = true
}

function closeForm() {
  if (saving.value) return
  showForm.value = false
}

async function save() {
  formError.value = ''
  if (!form.full_name.trim()) {
    formError.value = 'Nama lengkap wajib diisi.'
    return
  }
  const data = {
    full_name: form.full_name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    status: form.status,
    assigned_classes: form.assigned.join(','),
  }
  saving.value = true
  try {
    if (editingId.value) {
      await masterApi.update('teachers', editingId.value, data)
      toast.success('Data guru diperbarui.')
    } else {
      await masterApi.create('teachers', data)
      toast.success('Guru baru ditambahkan.')
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ---------- Hapus ----------
const deleting = ref(null)
const deleteError = ref('')
const deleteLoading = ref(false)

function askDelete(t) {
  deleting.value = t
  deleteError.value = ''
}

async function doDelete() {
  deleteLoading.value = true
  deleteError.value = ''
  try {
    await masterApi.remove('teachers', deleting.value.teacher_id)
    toast.success('Data guru dihapus.')
    deleting.value = null
    // Kalau halaman terakhir menjadi kosong, mundur satu halaman.
    if (items.value.length === 1 && page.value > 1) page.value -= 1
    await load()
  } catch (e) {
    deleteError.value = e.message
  } finally {
    deleteLoading.value = false
  }
}

// ---------- Umum ----------
function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (showForm.value) closeForm()
  else if (deleting.value && !deleteLoading.value) deleting.value = null
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    const opt = await masterApi.options()
    classes.value = opt.classes || []
  } catch { /* daftar kelas tidak wajib untuk menampilkan guru */ }
  load()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(searchTimer)
})

const badgeClass = (status) =>
  status === 'active'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-slate-100 text-slate-600 ring-slate-200'
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-navy-900">Data Guru</h1>
        <p class="mt-1 text-sm text-slate-500">Kelola data guru dan kelas yang diajar.</p>
      </div>
      <BaseButton @click="openCreate"><Plus class="mr-2 h-4 w-4" /> Tambah guru</BaseButton>
    </div>

    <!-- Pencarian & filter -->
    <div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          v-model="search"
          type="search"
          placeholder="Cari nama, ID, atau email guru"
          class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
          aria-label="Cari guru"
        />
      </div>
      <select
        v-model="statusFilter"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
        aria-label="Filter status"
      >
        <option value="">Semua status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
      </select>
    </div>

    <p v-if="listError" class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" /> <span>{{ listError }}</span>
    </p>

    <p v-if="loading && !items.length" class="py-8 text-center text-sm text-slate-500">Memuat data guru…</p>

    <!-- Kosong -->
    <div v-else-if="!loading && !items.length && !listError" class="card grid place-items-center gap-2 px-6 py-14 text-center">
      <UserSquare2 class="h-10 w-10 text-slate-300" />
      <p class="font-semibold text-slate-700">{{ search || statusFilter ? 'Tidak ada guru yang cocok' : 'Belum ada data guru' }}</p>
      <p class="text-sm text-slate-500">
        {{ search || statusFilter ? 'Coba ubah kata kunci atau filter.' : 'Klik "Tambah guru" untuk menambahkan guru pertama.' }}
      </p>
    </div>

    <template v-else-if="items.length">
      <!-- Tabel (layar sedang ke atas) -->
      <div class="card hidden overflow-hidden md:block" :class="loading ? 'opacity-60' : ''">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3 font-semibold">Guru</th>
              <th class="px-4 py-3 font-semibold">Kontak</th>
              <th class="px-4 py-3 font-semibold">Kelas yang diajar</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="t in items" :key="t.teacher_id" class="hover:bg-slate-50/60">
              <td class="px-4 py-3">
                <p class="font-medium text-slate-800">{{ t.full_name }}</p>
                <p class="text-xs text-slate-500">{{ t.teacher_id }}</p>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <p>{{ t.email || '-' }}</p>
                <p class="text-xs text-slate-500">{{ t.phone || '-' }}</p>
              </td>
              <td class="px-4 py-3">
                <div v-if="classLabels(t).length" class="flex flex-wrap gap-1">
                  <span v-for="c in classLabels(t)" :key="c" class="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{{ c }}</span>
                </div>
                <span v-else class="text-slate-400">-</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" :class="badgeClass(t.status)">{{ STATUS_LABEL[t.status] || t.status }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <button type="button" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" :aria-label="`Ubah ${t.full_name}`" @click="openEdit(t)"><Pencil class="h-4 w-4" /></button>
                  <button type="button" class="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" :aria-label="`Hapus ${t.full_name}`" @click="askDelete(t)"><Trash2 class="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Kartu (HP) -->
      <ul class="space-y-3 md:hidden" :class="loading ? 'opacity-60' : ''">
        <li v-for="t in items" :key="t.teacher_id" class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-800">{{ t.full_name }}</p>
              <p class="text-xs text-slate-500">{{ t.teacher_id }}</p>
            </div>
            <span class="inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" :class="badgeClass(t.status)">{{ STATUS_LABEL[t.status] || t.status }}</span>
          </div>
          <dl class="mt-3 space-y-1 text-sm">
            <div class="flex gap-2"><dt class="w-20 shrink-0 text-slate-500">Email</dt><dd class="min-w-0 break-words text-slate-700">{{ t.email || '-' }}</dd></div>
            <div class="flex gap-2"><dt class="w-20 shrink-0 text-slate-500">No. HP</dt><dd class="text-slate-700">{{ t.phone || '-' }}</dd></div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-slate-500">Kelas</dt>
              <dd class="flex flex-wrap gap-1">
                <span v-for="c in classLabels(t)" :key="c" class="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{{ c }}</span>
                <span v-if="!classLabels(t).length" class="text-slate-400">-</span>
              </dd>
            </div>
          </dl>
          <div class="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100" @click="openEdit(t)"><Pencil class="h-4 w-4" /> Ubah</button>
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50" @click="askDelete(t)"><Trash2 class="h-4 w-4" /> Hapus</button>
          </div>
        </li>
      </ul>

      <!-- Halaman -->
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>{{ rangeText }}</p>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40" :disabled="page <= 1 || loading" @click="goTo(page - 1)">Sebelumnya</button>
          <span>Hal. {{ page }} / {{ pages }}</span>
          <button type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40" :disabled="page >= pages || loading" @click="goTo(page + 1)">Berikutnya</button>
        </div>
      </div>
    </template>

    <!-- Modal tambah / ubah -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" @click.self="closeForm">
      <div class="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="judul-form-guru">
        <div class="flex items-center justify-between">
          <h2 id="judul-form-guru" class="text-lg font-bold text-navy-900">{{ editingId ? 'Ubah data guru' : 'Tambah guru' }}</h2>
          <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tutup" @click="closeForm"><X class="h-5 w-5" /></button>
        </div>

        <p v-if="formError" class="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" /> <span>{{ formError }}</span>
        </p>

        <form class="mt-5 space-y-4" novalidate @submit.prevent="save">
          <BaseInput v-model="form.full_name" label="Nama lengkap" autocomplete="off" :disabled="saving" />
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput v-model="form.email" label="Email" type="email" autocomplete="off" :disabled="saving" />
            <BaseInput v-model="form.phone" label="No. HP" type="tel" autocomplete="off" :disabled="saving" />
          </div>

          <div>
            <label for="status-guru" class="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
            <select id="status-guru" v-model="form.status" :disabled="saving" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30">
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          <fieldset>
            <legend class="mb-1.5 text-sm font-medium text-slate-700">Kelas yang diajar</legend>
            <p v-if="!classes.length" class="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Belum ada kelas. Tambahkan kelas terlebih dahulu.</p>
            <div v-else class="grid gap-2 sm:grid-cols-2">
              <label v-for="c in classes" :key="c.class_id" class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                <input v-model="form.assigned" type="checkbox" :value="c.class_id" :disabled="saving" class="h-4 w-4 rounded border-slate-300 text-royal-600" />
                {{ c.class_name }}
              </label>
            </div>
          </fieldset>

          <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" :disabled="saving" @click="closeForm">Batal</button>
            <BaseButton type="submit" :loading="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</BaseButton>
          </div>
        </form>
      </div>
    </div>

    <!-- Konfirmasi hapus -->
    <div v-if="deleting" class="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4" @click.self="!deleteLoading && (deleting = null)">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" role="alertdialog" aria-modal="true" aria-labelledby="judul-hapus-guru">
        <h2 id="judul-hapus-guru" class="text-lg font-bold text-navy-900">Hapus guru?</h2>
        <p class="mt-2 text-sm text-slate-600">
          Data <strong>{{ deleting.full_name }}</strong> akan dihapus permanen. Untuk berhenti memakainya tanpa menghapus, ubah statusnya menjadi Nonaktif.
        </p>
        <p v-if="deleteError" class="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" /> <span>{{ deleteError }}</span>
        </p>
        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" :disabled="deleteLoading" @click="deleting = null">Batal</button>
          <button type="button" class="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60" :disabled="deleteLoading" @click="doDelete">{{ deleteLoading ? 'Menghapus…' : 'Ya, hapus' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
