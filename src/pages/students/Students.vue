
<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Search,
  Plus,
  Users,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  GraduationCap,
  AlertCircle,
  LoaderCircle,
  CalendarDays,
  Phone,
  MapPin,
} from 'lucide-vue-next'
import studentsService from '@/services/students'

const students = ref([])
const classOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const selectedClass = ref('Semua Kelas')
const showForm = ref(false)
const editingId = ref(null)
const showDeleteConfirm = ref(false)
const deletingStudent = ref(null)

let searchTimer

const emptyForm = () => ({
  student_id: '',
  full_name: '',
  gender: 'L',
  class_id: '',
  date_of_birth: '',
  address: '',
  parent_name: '',
  parent_phone: '',
  barcode_value: '',
  photo_url: '',
  status: 'active',
})

const form = ref(emptyForm())

function ambilToken() {
  return (
    localStorage.getItem('ssa.token') ||
    localStorage.getItem('token') ||
    ''
  )
}

function formatJenisKelamin(gender) {
  if (gender === 'L') return 'Laki-laki'
  if (gender === 'P') return 'Perempuan'
  return '-'
}

function formatStatus(status) {
  return status === 'active' ? 'Aktif' : 'Nonaktif'
}

function namaKelas(classId) {
  const kelas = classOptions.value.find(
    item =>
      String(item.class_id ?? item.id) === String(classId)
  )

  return kelas?.class_name || kelas?.name || ''
}

function normalisasiSiswa(item) {
  return {
    studentId: item.student_id || '',
    nis: item.student_id || '',
    name: item.full_name || '',
    gender: item.gender || 'L',
    classId: item.class_id || '',
    className: namaKelas(item.class_id) || item.class_id || '-',
    dateOfBirth: item.date_of_birth || '',
    address: item.address || '',
    parentName: item.parent_name || '',
    phone: item.parent_phone || '',
    barcodeValue: item.barcode_value || '',
    photoUrl: item.photo_url || '',
    status: item.status || 'active',
  }
}

const classes = computed(() => [
  'Semua Kelas',
  ...new Set(
    students.value
      .map(student => student.className)
      .filter(value => value && value !== '-')
  ),
])

const filteredStudents = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return students.value.filter(student => {
    const matchesSearch =
      !keyword ||
      [
        student.nis,
        student.name,
        student.className,
        student.parentName,
        student.phone,
      ].some(value =>
        String(value || '').toLowerCase().includes(keyword)
      )

    const matchesClass =
      selectedClass.value === 'Semua Kelas' ||
      student.className === selectedClass.value

    return matchesSearch && matchesClass
  })
})

const activeCount = computed(
  () => students.value.filter(student => student.status === 'active').length
)

const inactiveCount = computed(
  () => students.value.filter(student => student.status !== 'active').length
)

async function loadStudents() {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = ambilToken()

    if (!token) {
      throw new Error('Sesi masuk tidak ditemukan. Silakan masuk kembali.')
    }

    // Muat pilihan kelas dari backend.
    try {
      const optionsResult = await studentsService.options(token)

      if (Array.isArray(optionsResult)) {
        classOptions.value = optionsResult
      } else {
        classOptions.value =
          optionsResult?.classes ||
          optionsResult?.items ||
          []
      }
    } catch (error) {
      console.warn('Pilihan kelas tidak berhasil dimuat:', error)
    }

    const result = await studentsService.list(token, {
      page: 1,
      pageSize: 1000,
      search: search.value.trim(),
      sort: 'full_name',
      dir: 'asc',
    })

    // Format API: { ok: true, data: { items: [], total, page } }
    const items = Array.isArray(result)
      ? result
      : result?.items ||
        result?.data?.items ||
        []

    students.value = items.map(normalisasiSiswa)
  } catch (error) {
    console.error('Gagal memuat data siswa:', error)
    errorMessage.value =
      error?.message || 'Data siswa gagal dimuat.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  errorMessage.value = ''
  successMessage.value = ''
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function openEdit(student) {
  errorMessage.value = ''
  successMessage.value = ''
  editingId.value = student.studentId

  form.value = {
    student_id: student.studentId,
    full_name: student.name,
    gender: student.gender,
    class_id: student.classId,
    date_of_birth: student.dateOfBirth,
    address: student.address,
    parent_name: student.parentName,
    parent_phone: student.phone,
    barcode_value: student.barcodeValue,
    photo_url: student.photoUrl,
    status: student.status,
  }

  showForm.value = true
}

async function saveStudent() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.value.full_name.trim()) {
    errorMessage.value = 'Nama lengkap siswa wajib diisi.'
    return
  }

  if (!form.value.class_id) {
    errorMessage.value = 'Silakan pilih kelas siswa.'
    return
  }

  if (!editingId.value && !form.value.student_id.trim()) {
    errorMessage.value = 'ID siswa wajib diisi.'
    return
  }

  saving.value = true

  try {
    const token = ambilToken()

    if (!token) {
      throw new Error('Sesi masuk tidak ditemukan. Silakan masuk kembali.')
    }

    const data = {
      student_id: form.value.student_id.trim(),
      full_name: form.value.full_name.trim(),
      gender: form.value.gender,
      class_id: form.value.class_id,
      date_of_birth: form.value.date_of_birth,
      address: form.value.address.trim(),
      parent_name: form.value.parent_name.trim(),
      parent_phone: form.value.parent_phone.trim(),
      barcode_value:
        form.value.barcode_value.trim() ||
        form.value.student_id.trim(),
      photo_url: form.value.photo_url.trim(),
      status: form.value.status,
    }

    if (editingId.value) {
      // ID utama dipisahkan dari data yang diperbarui.
      await studentsService.update(token, editingId.value, data)
      successMessage.value = 'Data siswa berhasil diperbarui.'
    } else {
      await studentsService.create(token, data)
      successMessage.value = 'Siswa berhasil ditambahkan.'
    }

    showForm.value = false
    await loadStudents()
  } catch (error) {
    console.error('Gagal menyimpan data siswa:', error)
    errorMessage.value =
      error?.message || 'Data siswa gagal disimpan.'
  } finally {
    saving.value = false
  }
}

function confirmDelete(student) {
  errorMessage.value = ''
  deletingStudent.value = student
  showDeleteConfirm.value = true
}

async function deleteStudent() {
  if (!deletingStudent.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    const token = ambilToken()

    if (!token) {
      throw new Error('Sesi masuk tidak ditemukan. Silakan masuk kembali.')
    }

    await studentsService.remove(
      token,
      deletingStudent.value.studentId
    )

    showDeleteConfirm.value = false
    deletingStudent.value = null
    successMessage.value = 'Data siswa berhasil dihapus.'

    await loadStudents()
  } catch (error) {
    console.error('Gagal menghapus siswa:', error)
    errorMessage.value =
      error?.message || 'Data siswa gagal dihapus.'
  } finally {
    saving.value = false
  }
}

function tutupForm() {
  if (saving.value) return
  showForm.value = false
}

function formatTanggal(value) {
  if (!value) return '-'

  const tanggal = new Date(`${value}T00:00:00`)

  if (Number.isNaN(tanggal.getTime())) return value

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(tanggal)
}

onMounted(loadStudents)
</script>

<template>
  <div class="space-y-6 pb-8">
    <!-- Judul halaman -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <GraduationCap :size="17" />
          <span>Akademik</span>
          <span>/</span>
          <span class="text-slate-800">Data Siswa</span>
        </div>

        <h1 class="text-2xl font-bold tracking-tight text-slate-900">
          Data Siswa
        </h1>

        <p class="mt-1 text-sm text-slate-500">
          Kelola data siswa, kelas, dan informasi orang tua.
        </p>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          @click="loadStudents"
          :disabled="loading"
          class="inline-flex items-center justify-center gap-2 rounded-xl border
                 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold
                 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
          Muat Ulang
        </button>

        <button
          type="button"
          @click="openCreate"
          class="inline-flex items-center justify-center gap-2 rounded-xl
                 bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white
                 shadow-sm hover:bg-blue-800"
        >
          <Plus :size="17" />
          Tambah Siswa
        </button>
      </div>
    </div>

    <!-- Notifikasi -->
    <div
      v-if="errorMessage"
      class="flex items-start gap-3 rounded-xl border border-red-200
             bg-red-50 p-4 text-sm text-red-700"
    >
      <AlertCircle :size="19" class="mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1">{{ errorMessage }}</div>
      <button
        type="button"
        @click="errorMessage = ''"
        aria-label="Tutup pesan"
      >
        <X :size="17" />
      </button>
    </div>

    <div
      v-if="successMessage"
      class="flex items-start gap-3 rounded-xl border border-emerald-200
             bg-emerald-50 p-4 text-sm text-emerald-700"
    >
      <GraduationCap :size="19" class="mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1">{{ successMessage }}</div>
      <button
        type="button"
        @click="successMessage = ''"
        aria-label="Tutup pesan"
      >
        <X :size="17" />
      </button>
    </div>

    <!-- Ringkasan -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-500">Total Siswa</p>
          <div class="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <Users :size="21" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-slate-900">
          {{ students.length }}
        </p>
        <p class="mt-1 text-xs text-slate-500">Siswa yang dimuat</p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-500">Siswa Aktif</p>
          <div class="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <GraduationCap :size="21" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-slate-900">
          {{ activeCount }}
        </p>
        <p class="mt-1 text-xs text-slate-500">Status aktif</p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-500">Jumlah Kelas</p>
          <div class="rounded-xl bg-violet-50 p-2.5 text-violet-700">
            <Users :size="21" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-slate-900">
          {{ Math.max(classes.length - 1, 0) }}
        </p>
        <p class="mt-1 text-xs text-slate-500">Kelas yang memiliki siswa</p>
      </div>
    </div>

    <!-- Tabel siswa -->
    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
        <div class="relative min-w-0 flex-1">
          <Search
            :size="18"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="search"
            type="search"
            placeholder="Cari nama, ID, atau orang tua..."
            class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3
                   text-sm outline-none focus:border-blue-500 focus:ring-2
                   focus:ring-blue-100"
          />
        </div>

        <select
          v-model="selectedClass"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2.5
                 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option v-for="item in classes" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </div>

      <div
        v-if="loading && !students.length"
        class="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"
      >
        <LoaderCircle :size="20" class="animate-spin" />
        Memuat data siswa...
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-4 font-semibold">Siswa</th>
              <th class="px-5 py-4 font-semibold">ID Siswa</th>
              <th class="px-5 py-4 font-semibold">Jenis Kelamin</th>
              <th class="px-5 py-4 font-semibold">Kelas</th>
              <th class="px-5 py-4 font-semibold">Status</th>
              <th class="px-5 py-4 text-right font-semibold">Aksi</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="student in filteredStudents"
              :key="student.studentId"
              class="hover:bg-slate-50/70"
            >
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <img
                    v-if="student.photoUrl"
                    :src="student.photoUrl"
                    :alt="student.name"
                    class="h-10 w-10 shrink-0 rounded-full object-cover"
                  />

                  <div
                    v-else
                    class="flex h-10 w-10 shrink-0 items-center justify-center
                           rounded-full bg-blue-50 font-bold text-blue-700"
                  >
                    {{ (student.name || '?').charAt(0).toUpperCase() }}
                  </div>

                  <div class="min-w-0">
                    <p class="font-semibold text-slate-800">
                      {{ student.name }}
                    </p>
                    <p class="mt-1 text-xs text-slate-400">
                      {{ student.phone || 'Nomor orang tua belum diisi' }}
                    </p>
                  </div>
                </div>
              </td>

              <td class="px-5 py-4 text-slate-600">
                {{ student.nis }}
              </td>

              <td class="px-5 py-4 text-slate-600">
                {{ formatJenisKelamin(student.gender) }}
              </td>

              <td class="px-5 py-4 text-slate-600">
                {{ student.className }}
              </td>

              <td class="px-5 py-4">
                <span
                  class="rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="student.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'"
                >
                  {{ formatStatus(student.status) }}
                </span>
              </td>

              <td class="px-5 py-4">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    @click="openEdit(student)"
                    class="rounded-lg border border-slate-200 p-2 text-slate-600
                           hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    aria-label="Edit siswa"
                  >
                    <Pencil :size="16" />
                  </button>

                  <button
                    type="button"
                    @click="confirmDelete(student)"
                    class="rounded-lg border border-slate-200 p-2 text-slate-600
                           hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    aria-label="Hapus siswa"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!filteredStudents.length && !loading">
              <td colspan="6" class="px-5 py-14 text-center">
                <Users :size="32" class="mx-auto mb-3 text-slate-300" />
                <p class="font-semibold text-slate-700">
                  Data siswa belum ditemukan
                </p>
                <p class="mt-1 text-sm text-slate-500">
                  Coba ubah pencarian atau tambahkan siswa baru.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Menampilkan {{ filteredStudents.length }} dari {{ students.length }} siswa
      </div>
    </section>

    <!-- Form tambah / edit -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto
             bg-slate-950/50 p-4"
      @click.self="tutupForm"
    >
      <section class="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <header class="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 class="text-lg font-bold text-slate-900">
              {{ editingId ? 'Edit Data Siswa' : 'Tambah Siswa Baru' }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Lengkapi informasi siswa dan orang tua.
            </p>
          </div>

          <button
            type="button"
            @click="tutupForm"
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Tutup formulir"
          >
            <X :size="20" />
          </button>
        </header>

        <form @submit.prevent="saveStudent" class="space-y-4 p-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm font-medium text-slate-700">
              ID Siswa
              <span class="text-red-500">*</span>
              <input
                v-model.trim="form.student_id"
                required
                :disabled="Boolean(editingId)"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5
                       font-normal outline-none focus:border-blue-500
                       disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="Contoh: STU-0002"
              />
              <span class="mt-1 block text-xs font-normal text-slate-400">
                ID tidak dapat diubah setelah siswa dibuat.
              </span>
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Nama Lengkap
              <span class="text-red-500">*</span>
              <input
                v-model.trim="form.full_name"
                required
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5
                       font-normal outline-none focus:border-blue-500"
                placeholder="Nama lengkap siswa"
              />
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Jenis Kelamin
              <select
                v-model="form.gender"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white
                       px-3 py-2.5 font-normal outline-none focus:border-blue-500"
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Kelas
              <span class="text-red-500">*</span>
              <select
                v-model="form.class_id"
                required
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white
                       px-3 py-2.5 font-normal outline-none focus:border-blue-500"
              >
                <option value="" disabled>Pilih kelas</option>
                <option
                  v-for="kelas in classOptions"
                  :key="kelas.class_id || kelas.id"
                  :value="kelas.class_id || kelas.id"
                >
                  {{ kelas.class_name || kelas.name }}
                </option>
              </select>
              <span
                v-if="!classOptions.length"
                class="mt-1 block text-xs font-normal text-amber-600"
              >
                Pilihan kelas belum tersedia dari API.
              </span>
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Tanggal Lahir
              <span class="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <CalendarDays :size="16" class="text-slate-400" />
                <input
                  v-model="form.date_of_birth"
                  type="date"
                  class="w-full py-2.5 font-normal outline-none"
                />
              </span>
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Nomor Telepon Orang Tua
              <span class="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Phone :size="16" class="text-slate-400" />
                <input
                  v-model.trim="form.parent_phone"
                  type="tel"
                  class="w-full py-2.5 font-normal outline-none"
                  placeholder="08xxxxxxxxxx"
                />
              </span>
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Nama Orang Tua
              <input
                v-model.trim="form.parent_name"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5
                       font-normal outline-none focus:border-blue-500"
                placeholder="Nama orang tua/wali"
              />
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Status
              <select
                v-model="form.status"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white
                       px-3 py-2.5 font-normal outline-none focus:border-blue-500"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
          </div>

          <label class="block text-sm font-medium text-slate-700">
            <span class="flex items-center gap-2">
              <MapPin :size="16" />
              Alamat
            </span>
            <textarea
              v-model.trim="form.address"
              rows="2"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5
                     font-normal outline-none focus:border-blue-500"
              placeholder="Alamat lengkap siswa"
            ></textarea>
          </label>

          <label class="block text-sm font-medium text-slate-700">
            Nilai Barcode
            <input
              v-model.trim="form.barcode_value"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5
                     font-normal outline-none focus:border-blue-500"
              placeholder="Kosongkan untuk menggunakan ID siswa"
            />
          </label>

          <label class="block text-sm font-medium text-slate-700">
            URL Foto Siswa
            <input
              v-model.trim="form.photo_url"
              type="url"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5
                     font-normal outline-none focus:border-blue-500"
              placeholder="https://..."
            />
          </label>

          <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              @click="tutupForm"
              :disabled="saving"
              class="rounded-xl border border-slate-200 px-4 py-2.5
                     text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center gap-2 rounded-xl bg-blue-700
                     px-5 py-2.5 text-sm font-semibold text-white
                     hover:bg-blue-800 disabled:opacity-50"
            >
              <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
              {{ saving ? 'Menyimpan...' : 'Simpan Siswa' }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <!-- Konfirmasi hapus -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="showDeleteConfirm = false"
    >
      <section class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Trash2 :size="23" />
        </div>

        <h2 class="text-lg font-bold text-slate-900">
          Hapus data siswa?
        </h2>

        <p class="mt-2 text-sm leading-6 text-slate-500">
          Data siswa
          <strong>{{ deletingStudent?.name }}</strong>
          akan dihapus. Tindakan ini tidak dapat dibatalkan.
        </p>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            @click="showDeleteConfirm = false"
            :disabled="saving"
            class="rounded-xl border border-slate-200 px-4 py-2.5
                   text-sm font-semibold disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            @click="deleteStudent"
            :disabled="saving"
            class="inline-flex items-center gap-2 rounded-xl bg-red-600
                   px-4 py-2.5 text-sm font-semibold text-white
                   hover:bg-red-700 disabled:opacity-50"
          >
            <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
            {{ saving ? 'Memproses...' : 'Ya, Hapus' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
