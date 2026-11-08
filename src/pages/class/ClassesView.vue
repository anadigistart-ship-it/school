<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  School,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Users,
  UserRound,
  CalendarDays,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'

/*
 * ADAPTER API — satu-satunya bagian yang mungkin perlu disesuaikan.
 * callApi(action, payload) harus mengirim { action, token, payload } ke Apps Script
 * dan mengembalikan isi `data` (melempar Error dengan .message jika ok:false).
 */
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth' // sesuaikan dengan lokasi token Anda

const auth = useAuthStore()
const callApi = (action, payload) => api(action, payload, auth.token)

const ENTITY = 'classes'

// ---------- State data ----------
const items = ref([])
const teachers = ref([])
const students = ref([])
const loading = ref(false)
const error = ref('')

// ---------- Filter, sort, halaman ----------
const search = ref('')
const gradeFilter = ref('')
const yearFilter = ref('')
const sortKey = ref('class_name')
const sortDir = ref('asc')
const page = ref(1)
const pageSize = 10

// ---------- Form tambah/ubah ----------
const showForm = ref(false)
const editingId = ref('')
const saving = ref(false)
const formError = ref('')
const form = ref(emptyForm())

// ---------- Hapus ----------
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')

// ---------- Toast ----------
const toast = ref('')
let toastTimer = null

const GRADES = ['1', '2', '3', '4', '5', '6']

function defaultAcademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  const start = now.getMonth() >= 6 ? y : y - 1 // tahun ajaran baru mulai Juli
  return `${start}/${start + 1}`
}

function emptyForm() {
  return {
    class_name: '',
    grade_level: '1',
    homeroom_teacher_id: '',
    academic_year: defaultAcademicYear(),
  }
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 3000)
}

// ---------- Data turunan ----------
const teacherName = computed(() => {
  const map = {}
  teachers.value.forEach((t) => (map[t.teacher_id] = t.full_name))
  return map
})

const studentCount = computed(() => {
  const map = {}
  students.value.forEach((s) => {
    map[s.class_id] = (map[s.class_id] || 0) + 1
  })
  return map
})

const years = computed(() =>
  [...new Set(items.value.map((c) => c.academic_year).filter(Boolean))]
    .sort()
    .reverse()
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()

  return items.value.filter((c) => {
    if (gradeFilter.value && c.grade_level !== gradeFilter.value) return false
    if (yearFilter.value && c.academic_year !== yearFilter.value) return false
    if (!q) return true

    return [c.class_id, c.class_name, teacherName.value[c.homeroom_teacher_id]]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })
})

const sorted = computed(() => {
  const dir = sortDir.value === 'desc' ? -1 : 1
  const key = sortKey.value

  return [...filtered.value].sort((a, b) =>
    String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'id', {
      numeric: true,
      sensitivity: 'base',
    }) * dir
  )
})

const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize)))

const paged = computed(() => {
  const p = Math.min(page.value, pages.value)
  return sorted.value.slice((p - 1) * pageSize, p * pageSize)
})

const stats = computed(() => ({
  classes: items.value.length,
  students: students.value.length,
  noHomeroom: items.value.filter((c) => !c.homeroom_teacher_id).length,
}))

watch([search, gradeFilter, yearFilter], () => {
  page.value = 1
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

// ---------- Muat data ----------
async function load() {
  loading.value = true
  error.value = ''

  try {
    const [list, opt] = await Promise.all([
      callApi('list', { entity: ENTITY, all: true }),
      callApi('options', {}),
    ])

    items.value = list.items || []
    teachers.value = opt.teachers || []
    students.value = opt.students || []
  } catch (e) {
    error.value = e.message || 'Gagal memuat data kelas.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ---------- Form ----------
function openCreate() {
  editingId.value = ''
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(c) {
  editingId.value = c.class_id
  form.value = {
    class_name: c.class_name || '',
    grade_level: c.grade_level || '1',
    homeroom_teacher_id: c.homeroom_teacher_id || '',
    academic_year: c.academic_year || '',
  }
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  if (saving.value) return
  showForm.value = false
}

function validateForm() {
  const f = form.value
  if (!f.class_name.trim()) return 'Nama kelas wajib diisi.'
  if (!GRADES.includes(f.grade_level)) return 'Pilih tingkat kelas 1–6.'
  if (f.academic_year && !/^\d{4}\/\d{4}$/.test(f.academic_year.trim())) {
    return 'Tahun ajaran harus berformat 2026/2027.'
  }
  return ''
}

async function saveForm() {
  formError.value = validateForm()
  if (formError.value) return

  saving.value = true

  const data = {
    class_name: form.value.class_name.trim(),
    grade_level: form.value.grade_level,
    homeroom_teacher_id: form.value.homeroom_teacher_id,
    academic_year: form.value.academic_year.trim(),
  }

  try {
    if (editingId.value) {
      await callApi('update', { entity: ENTITY, id: editingId.value, data })
    } else {
      await callApi('create', { entity: ENTITY, data })
    }

    showForm.value = false
    showToast(editingId.value ? 'Kelas berhasil diperbarui.' : 'Kelas berhasil ditambahkan.')
    await load()
  } catch (e) {
    formError.value = e.message || 'Gagal menyimpan kelas.'
  } finally {
    saving.value = false
  }
}

// ---------- Hapus ----------
function askDelete(c) {
  deleteTarget.value = c
  deleteError.value = ''
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  deleting.value = true
  deleteError.value = ''

  try {
    await callApi('remove', { entity: ENTITY, id: deleteTarget.value.class_id })
    deleteTarget.value = null
    showToast('Kelas berhasil dihapus.')
    await load()
  } catch (e) {
    // Mis. "Kelas ini masih punya N siswa. Pindahkan siswanya dulu."
    deleteError.value = e.message || 'Gagal menghapus kelas.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">

    <!-- HEADER -->
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div class="relative overflow-hidden bg-gradient-to-r from-[#10264d] via-[#173b78] to-[#2452cf] px-6 py-6 text-white">

        <div class="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[25px] border-white/5"></div>
        <div class="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-amber-400/10"></div>

        <div class="relative flex flex-wrap items-center justify-between gap-4">

          <div class="flex items-center gap-4">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
              <School :size="30" />
            </div>

            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Data Master
              </div>
              <h1 class="mt-1 text-2xl font-extrabold tracking-tight">Data Kelas</h1>
              <p class="mt-1 text-sm text-blue-100">
                Kelola kelas, tingkat, wali kelas, dan tahun ajaran.
              </p>
            </div>
          </div>

          <BaseButton @click="openCreate">
            <Plus class="mr-2 h-4 w-4" />
            Tambah Kelas
          </BaseButton>

        </div>
      </div>

      <!-- RINGKASAN -->
      <div class="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">

        <div class="flex items-center gap-3 px-5 py-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <School class="h-5 w-5" />
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Total kelas</div>
            <div class="text-xl font-extrabold text-slate-800">{{ stats.classes }}</div>
          </div>
        </div>

        <div class="flex items-center gap-3 px-5 py-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Users class="h-5 w-5" />
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Total siswa</div>
            <div class="text-xl font-extrabold text-slate-800">{{ stats.students }}</div>
          </div>
        </div>

        <div class="flex items-center gap-3 px-5 py-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <UserRound class="h-5 w-5" />
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Belum ada wali kelas</div>
            <div class="text-xl font-extrabold text-slate-800">{{ stats.noHomeroom }}</div>
          </div>
        </div>

      </div>
    </div>

    <!-- ERROR -->
    <div
      v-if="error"
      class="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      role="alert"
    >
      <AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
      <div class="flex-1">{{ error }}</div>
      <button class="font-semibold underline" @click="load">Coba lagi</button>
    </div>

    <!-- FILTER -->
    <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

      <div class="relative min-w-[220px] flex-1">
        <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Cari</label>
        <Search class="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
        <input
          v-model="search"
          type="search"
          placeholder="Nama kelas, ID, atau wali kelas"
          class="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div>
        <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Tingkat</label>
        <select
          v-model="gradeFilter"
          class="min-w-[140px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">Semua</option>
          <option v-for="g in GRADES" :key="g" :value="g">Kelas {{ g }}</option>
        </select>
      </div>

      <div>
        <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Tahun ajaran</label>
        <select
          v-model="yearFilter"
          class="min-w-[160px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">Semua</option>
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>

    </div>

    <!-- LOADING -->
    <div
      v-if="loading"
      class="flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-8 text-sm font-medium text-blue-700"
    >
      <LoaderCircle class="h-5 w-5 animate-spin" />
      Memuat data kelas...
    </div>

    <!-- KOSONG -->
    <div
      v-else-if="!items.length && !error"
      class="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <GraduationCap class="mx-auto h-12 w-12 text-slate-300" />
      <p class="mt-3 font-semibold text-slate-600">Belum ada data kelas</p>
      <p class="mt-1 text-sm text-slate-400">Klik "Tambah Kelas" untuk membuat kelas pertama.</p>
    </div>

    <!-- TABEL -->
    <div v-else-if="items.length" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3">
                <button class="inline-flex items-center gap-1 font-bold" @click="toggleSort('class_name')">
                  Kelas <ArrowUpDown class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-5 py-3">
                <button class="inline-flex items-center gap-1 font-bold" @click="toggleSort('grade_level')">
                  Tingkat <ArrowUpDown class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-5 py-3 font-bold">Wali kelas</th>
              <th class="px-5 py-3">
                <button class="inline-flex items-center gap-1 font-bold" @click="toggleSort('academic_year')">
                  Tahun ajaran <ArrowUpDown class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-5 py-3 text-center font-bold">Siswa</th>
              <th class="px-5 py-3 text-right font-bold">Aksi</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="c in paged"
              :key="c.class_id"
              class="transition hover:bg-blue-50/40"
            >
              <td class="px-5 py-3">
                <div class="font-bold text-slate-800">{{ c.class_name }}</div>
                <div class="text-xs text-slate-400">{{ c.class_id }}</div>
              </td>

              <td class="px-5 py-3">
                <span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  Kelas {{ c.grade_level }}
                </span>
              </td>

              <td class="px-5 py-3">
                <span v-if="teacherName[c.homeroom_teacher_id]" class="text-slate-700">
                  {{ teacherName[c.homeroom_teacher_id] }}
                </span>
                <span v-else class="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                  Belum ditetapkan
                </span>
              </td>

              <td class="px-5 py-3">
                <span class="inline-flex items-center gap-1.5 text-slate-600">
                  <CalendarDays class="h-4 w-4 text-slate-400" />
                  {{ c.academic_year || '-' }}
                </span>
              </td>

              <td class="px-5 py-3 text-center">
                <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                  {{ studentCount[c.class_id] || 0 }}
                </span>
              </td>

              <td class="px-5 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    class="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    :aria-label="`Ubah ${c.class_name}`"
                    @click="openEdit(c)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                    :aria-label="`Hapus ${c.class_name}`"
                    @click="askDelete(c)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!paged.length">
              <td colspan="6" class="px-5 py-10 text-center text-sm text-slate-400">
                Tidak ada kelas yang cocok dengan filter.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- PAGINASI -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <span>{{ sorted.length }} kelas</span>

        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
            :disabled="page <= 1"
            aria-label="Halaman sebelumnya"
            @click="page--"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <span class="font-semibold">Halaman {{ Math.min(page, pages) }} / {{ pages }}</span>
          <button
            class="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
            :disabled="page >= pages"
            aria-label="Halaman berikutnya"
            @click="page++"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL TAMBAH / UBAH -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      @click.self="closeForm"
      @keydown.esc="closeForm"
    >
      <form
        class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        @submit.prevent="saveForm"
      >
        <div class="flex items-center justify-between bg-gradient-to-r from-[#10264d] to-[#2452cf] px-5 py-4 text-white">
          <h2 class="font-bold">
            {{ editingId ? 'Ubah Kelas' : 'Tambah Kelas' }}
          </h2>
          <button type="button" class="rounded-lg p-1 hover:bg-white/10" aria-label="Tutup" @click="closeForm">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4 p-5">

          <div
            v-if="formError"
            class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
            {{ formError }}
          </div>

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Nama kelas</label>
            <input
              v-model="form.class_name"
              type="text"
              maxlength="30"
              placeholder="Contoh: Kelas 1A"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Tingkat</label>
              <select
                v-model="form.grade_level"
                class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option v-for="g in GRADES" :key="g" :value="g">Kelas {{ g }}</option>
              </select>
            </div>

            <div>
              <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Tahun ajaran</label>
              <input
                v-model="form.academic_year"
                type="text"
                maxlength="9"
                placeholder="2026/2027"
                class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Wali kelas</label>
            <select
              v-model="form.homeroom_teacher_id"
              class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">— Belum ditetapkan —</option>
              <option v-for="t in teachers" :key="t.teacher_id" :value="t.teacher_id">
                {{ t.full_name }}
              </option>
            </select>
          </div>

        </div>

        <div class="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            :disabled="saving"
            @click="closeForm"
          >
            Batal
          </button>
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded-xl bg-[#173b78] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#10264d] disabled:opacity-60"
            :disabled="saving"
          >
            <LoaderCircle v-if="saving" class="h-4 w-4 animate-spin" />
            {{ editingId ? 'Simpan Perubahan' : 'Simpan' }}
          </button>
        </div>
      </form>
    </div>

    <!-- MODAL HAPUS -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      @click.self="!deleting && (deleteTarget = null)"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 class="h-5 w-5" />
          </div>
          <div>
            <h2 class="font-bold text-slate-800">Hapus kelas?</h2>
            <p class="mt-1 text-sm text-slate-500">
              <b>{{ deleteTarget.class_name }}</b> akan dihapus permanen.
              Kelas yang masih punya siswa tidak bisa dihapus.
            </p>
          </div>
        </div>

        <div
          v-if="deleteError"
          class="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
          {{ deleteError }}
        </div>

        <div class="mt-5 flex justify-end gap-3">
          <button
            class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            :disabled="deleting"
            @click="deleteTarget = null"
          >
            Batal
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <LoaderCircle v-if="deleting" class="h-4 w-4 animate-spin" />
            Hapus
          </button>
        </div>
      </div>
    </div>

    <!-- TOAST -->
    <transition name="fade">
      <div
        v-if="toast"
        class="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
        role="status"
      >
        <CheckCircle2 class="h-4 w-4 text-emerald-400" />
        {{ toast }}
      </div>
    </transition>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
