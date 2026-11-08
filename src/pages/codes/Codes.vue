<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import {
  Printer,
  AlertCircle,
  GraduationCap,
  School,
  IdCard,
  ScanLine,
  LoaderCircle,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { attendanceApi } from '@/api/attendance'

const classes = ref([])
const classId = ref('')
const students = ref([])
const codeMap = ref({})
const school = ref({
  school_name: 'SDN NO 96 SUMBER AGUNG',
  school_logo: '',
  school_address: '',
})

const mode = ref('qr')
const loading = ref(false)
const error = ref('')
const logoFailed = ref(false)
// Logo lokal: public/image/logo.png
const logoSrc = `${import.meta.env.BASE_URL}image/logo.png`
const className = computed(() => {
  const c = classes.value.find(
    (x) => String(x.class_id) === String(classId.value)
  )
  return c ? c.class_name : 'Semua Kelas'
})

const schoolName = computed(() => 'SD Negeri 096/VIII Sumber Agung')
const npsn = '10503138'

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// yyyy-mm-dd -> 12 Mei 2019
function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!m) return String(value || '')
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`
}

// Tempat, tanggal lahir. `birth_place` opsional (belum ada di sheet Students).
function birthInfo(s) {
  return [s.birth_place, formatDate(s.date_of_birth)].filter(Boolean).join(', ') || '-'
}

function codeValue(s) {
  return String(s.barcode_value || s.student_id || '')
}

// Mendukung field gender maupun jenis_kelamin dari API.
// L = laki-laki; P = perempuan (memakai jilbab).
// F / PEREMPUAN tetap didukung sebagai alias dari sumber data lain.
function genderValue(s) {
  const value = String(s.gender || s.jenis_kelamin || '').trim().toUpperCase()
  return ['P', 'F', 'PEREMPUAN'].includes(value) ? 'F' : 'L'
}

async function makeCode(value) {
  if (!value) return ''

  if (mode.value === 'barcode') {
    const canvas = document.createElement('canvas')

    JsBarcode(canvas, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 4,
      height: 90,
      width: 3,
      background: '#ffffff',
      lineColor: '#10264d',
    })

    return canvas.toDataURL('image/png')
  }

  return QRCode.toDataURL(value, {
    margin: 1,
    width: 400,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#10264d',
      light: '#ffffff',
    },
  })
}

async function generateCodes() {
  const entries = await Promise.all(
    students.value.map(async (s) => {
      try {
        return [s.student_id, await makeCode(codeValue(s))]
      } catch (e) {
        console.error('Gagal membuat kode:', s.student_id, e)
        return [s.student_id, '']
      }
    })
  )

  codeMap.value = Object.fromEntries(entries)
}

async function loadStudents() {
  loading.value = true
  error.value = ''

  try {
    const data = await attendanceApi.listStudents(classId.value)

    students.value = data.items || []

    await generateCodes()
  } catch (e) {
    error.value = e.message || 'Gagal memuat data siswa.'
    students.value = []
    codeMap.value = {}
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const opt = await attendanceApi.options()
    classes.value = opt.classes || []

    try {
      const info = await attendanceApi.schoolInfo()
      school.value = {
        ...school.value,
        ...info,
      }
    } catch {
      console.warn('Informasi sekolah belum tersedia.')
    }

    if (classes.value.length) {
      classId.value = classes.value[0].class_id
    } else {
      await loadStudents()
    }
  } catch (e) {
    error.value = e.message || 'Gagal memuat pilihan kelas.'
  }
})

watch(classId, (value) => {
  if (value) loadStudents()
})

watch(mode, async () => {
  if (!students.value.length) return

  loading.value = true

  try {
    await generateCodes()
  } finally {
    loading.value = false
  }
})

async function printCards() {
  if (!students.value.length || loading.value) return

  await nextTick()

  const printImages = Array.from(
    document.querySelectorAll('.print-area img')
  )

  await Promise.all(
    printImages.map((img) => {
      if (img.complete) return Promise.resolve()

      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true })
        img.addEventListener('error', resolve, { once: true })
      })
    })
  )

  await new Promise((resolve) => requestAnimationFrame(() => resolve()))

  window.print()
}
</script>

<template>
  <div class="space-y-6 student-card-page">

    <!-- TOOLBAR -->
    <div class="no-print overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div class="relative overflow-hidden bg-gradient-to-r from-[#10264d] via-[#173b78] to-[#2452cf] px-6 py-6 text-white">

        <div class="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[25px] border-white/5"></div>
        <div class="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-cyan-400/10"></div>

        <div class="relative flex flex-wrap items-center justify-between gap-4">

          <div class="flex items-center gap-4">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
              <IdCard :size="30" />
            </div>

            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                Sistem Administrasi Sekolah
              </div>
              <h1 class="mt-1 text-2xl font-extrabold tracking-tight">
                Cetak Kartu Siswa
              </h1>
              <p class="mt-1 text-sm text-blue-100">
                {{ schoolName }}
              </p>
            </div>
          </div>

          <div class="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
            <div class="text-xs text-blue-100">Total siswa</div>
            <div class="text-2xl font-extrabold">
              {{ students.length }}
            </div>
          </div>

        </div>
      </div>

      <div class="flex flex-wrap items-end justify-between gap-4 p-5">

        <div class="grid w-full gap-4 sm:w-auto sm:grid-cols-2">

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Pilih kelas
            </label>

            <select
              v-model="classId"
              class="w-full min-w-[180px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              aria-label="Pilih kelas"
            >
              <option
                v-for="c in classes"
                :key="c.class_id"
                :value="c.class_id"
              >
                {{ c.class_name }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Jenis kode absensi
            </label>

            <select
              v-model="mode"
              class="w-full min-w-[190px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              aria-label="Jenis kode"
            >
              <option value="qr">QR Code</option>
              <option value="barcode">Barcode Code 128</option>
            </select>
          </div>

        </div>

        <BaseButton
          :disabled="!students.length || loading"
          @click="printCards"
        >
          <Printer class="mr-2 h-4 w-4" />
          Cetak Kartu ({{ students.length }})
        </BaseButton>

      </div>

      <div class="flex flex-wrap gap-4 border-t border-slate-100 bg-slate-50 px-5 py-3">

        <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
          <ScanLine class="h-4 w-4 text-blue-600" />
          {{ mode === 'qr' ? 'QR Code Absensi' : 'Barcode Code 128' }}
        </div>

        <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
          <IdCard class="h-4 w-4 text-blue-600" />
          Ukuran ID-1 portrait (54 × 85,6 mm)
        </div>

        <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
          <School class="h-4 w-4 text-blue-600" />
          {{ className }}
        </div>

      </div>
    </div>

    <!-- ERROR -->
    <div
      v-if="error"
      class="no-print flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      role="alert"
    >
      <AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
      {{ error }}
    </div>

    <!-- LOADING -->
    <div
      v-if="loading"
      class="no-print flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-8 text-sm font-medium text-blue-700"
    >
      <LoaderCircle class="h-5 w-5 animate-spin" />
      Sedang menyiapkan data dan kode siswa...
    </div>

    <div
      v-else-if="!students.length && !error"
      class="no-print rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <GraduationCap class="mx-auto h-12 w-12 text-slate-300" />
      <p class="mt-3 font-semibold text-slate-600">
        Belum ada siswa aktif
      </p>
      <p class="mt-1 text-sm text-slate-400">
        Data siswa akan muncul setelah tersedia di kelas ini.
      </p>
    </div>

    <!-- PREVIEW -->
    <div v-if="students.length && !loading" class="no-print space-y-4">

      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-bold text-slate-800">Preview Kartu Siswa</h2>
          <p class="text-xs text-slate-500">
            Tampilan depan dan belakang sebelum dicetak.
          </p>
        </div>

        <span class="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
          {{ students.length }} Pasang Kartu
        </span>
      </div>

      <div class="grid gap-6">

        <div
          v-for="s in students"
          :key="s.student_id"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >

          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-slate-800">
                {{ s.full_name }}
              </p>
              <p class="text-xs text-slate-500">
                NISN: {{ s.student_id }}
              </p>
            </div>

            <span class="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
              Depan / Belakang
            </span>
          </div>

          <!-- Preview memakai markup & CSS yang sama dengan cetak, hanya diperbesar -->
          <div class="preview-pair">

            <div class="kartu kartu-depan">

              <div class="kartu-header">
                <div class="kop-identitas">
                  <img
                    v-if="!logoFailed"
                    class="kop-logo"
                    :src="logoSrc"
                    alt="Logo SD Negeri 096/VIII Sumber Agung"
                    @error="logoFailed = true"
                  />
                  <div v-else class="kop-logo-fallback">
                    <School :size="20" />
                  </div>
                  <div class="kop-teks">
                    <div class="kartu-sekolah">{{ schoolName }}</div>
                    <div class="kartu-npsn">NPSN {{ npsn }}</div>
                  </div>
                </div>
              </div>

              <div class="kartu-isi">

                <div class="kartu-foto-siswa" :aria-label="genderValue(s) === 'F' ? 'Siluet siswi berjilbab' : 'Siluet siswa laki-laki'">
                  <!-- Siluet siswa laki-laki -->
                  <svg
                    v-if="genderValue(s) === 'L'"
                    viewBox="0 0 120 140"
                    role="img"
                    aria-hidden="true"
                  >
                    <circle cx="60" cy="37" r="25" fill="currentColor" />
                    <path d="M35 31c2-20 17-29 31-27 14 1 23 12 24 27-8-7-16-10-27-10-10 0-19 4-28 10Z" fill="currentColor" />
                    <path d="M18 132c2-31 18-48 42-48s40 17 42 48H18Z" fill="currentColor" />
                    <path d="M43 84 60 105 77 84" fill="#fff" opacity=".9" />
                  </svg>

                  <!-- Siluet siswi perempuan dengan jilbab -->
                  <svg
                    v-else
                    viewBox="0 0 120 140"
                    role="img"
                    aria-hidden="true"
                  >
                    <path d="M60 8c-25 0-39 19-39 46 0 17 7 29 15 39-11 8-18 20-19 39h86c-1-19-8-31-19-39 8-10 15-22 15-39C99 27 85 8 60 8Z" fill="currentColor" />
                    <path d="M39 48c0-17 9-28 21-28s21 11 21 28v16c0 17-9 29-21 29S39 81 39 64V48Z" fill="#fff" opacity=".96" />
                    <path d="M34 44c5-23 16-34 26-34 14 0 25 12 29 34-9-8-18-12-29-12-10 0-18 4-26 12Z" fill="currentColor" />
                    <path d="M31 91c9 10 18 15 29 15s20-5 29-15l13 41H18l13-41Z" fill="currentColor" />
                  </svg>
                </div>

                <div class="kartu-data">
                  <div class="data-baris">
                    <span>Nama</span><i>:</i>
                    <b class="data-nama">{{ s.full_name }}</b>
                  </div>
                  <div class="data-baris">
                    <span>Tempat,<br />Tgl Lahir</span><i>:</i>

                    <b>{{ s.address || '-' }}, {{ birthInfo(s) }}</b>
                  </div>
                  <div class="data-baris">
                    <span>NISN</span><i>:</i>
                    <b>{{ s.student_id }}</b>
                  </div>
                  <div class="data-baris">
                    <span>Alamat</span><i>:</i>
                    <b class="data-alamat">{{ s.address || '-' }}</b>
                  </div>
                </div>

              </div>

              <div class="kartu-footer">BELAJAR • BERKARAKTER • BERPRESTASI</div>

            </div>

            <div class="kartu kartu-belakang">

              <div class="belakang-atas">
                <div class="belakang-judul">KARTU ABSENSI SISWA</div>
              </div>

              <div class="kode-panel">
                <img
                  v-if="codeMap[s.student_id]"
                  :src="codeMap[s.student_id]"
                  :alt="`Kode ${s.full_name}`"
                  :class="mode === 'qr' ? 'kode-qr' : 'kode-barcode'"
                />
                <div v-else class="kode-error">Kode tidak tersedia</div>
              </div>

              <p class="kode-teks">{{ codeValue(s) }}</p>

            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- PRINT AREA -->
    <div class="print-area">

      <div
        v-for="(s, index) in students"
        :key="`print-${s.student_id}`"
        class="kartu-baris"
        :class="{
          'page-break': (index + 1) % 3 === 0 && index + 1 < students.length
        }"
      >

        <div class="kartu kartu-depan">

              <div class="kartu-header">
                <div class="kop-identitas">
                  <img
                    v-if="!logoFailed"
                    class="kop-logo"
                    :src="logoSrc"
                    alt="Logo SD Negeri 096/VIII Sumber Agung"
                    @error="logoFailed = true"
                  />
                  <div v-else class="kop-logo-fallback">
                    <School :size="20" />
                  </div>
                  <div class="kop-teks">
                    <div class="kartu-sekolah">{{ schoolName }}</div>
                    <div class="kartu-npsn">NPSN {{ npsn }}</div>
                  </div>
                </div>
              </div>

              <div class="kartu-isi">

                <div class="kartu-foto-siswa" :aria-label="genderValue(s) === 'F' ? 'Siluet siswi berjilbab' : 'Siluet siswa laki-laki'">
                  <!-- Siluet siswa laki-laki -->
                  <svg
                    v-if="genderValue(s) === 'L'"
                    viewBox="0 0 120 140"
                    role="img"
                    aria-hidden="true"
                  >
                    <circle cx="60" cy="37" r="25" fill="currentColor" />
                    <path d="M35 31c2-20 17-29 31-27 14 1 23 12 24 27-8-7-16-10-27-10-10 0-19 4-28 10Z" fill="currentColor" />
                    <path d="M18 132c2-31 18-48 42-48s40 17 42 48H18Z" fill="currentColor" />
                    <path d="M43 84 60 105 77 84" fill="#fff" opacity=".9" />
                  </svg>

                  <!-- Siluet siswi perempuan dengan jilbab -->
                  <svg
                    v-else
                    viewBox="0 0 120 140"
                    role="img"
                    aria-hidden="true"
                  >
                    <path d="M60 8c-25 0-39 19-39 46 0 17 7 29 15 39-11 8-18 20-19 39h86c-1-19-8-31-19-39 8-10 15-22 15-39C99 27 85 8 60 8Z" fill="currentColor" />
                    <path d="M39 48c0-17 9-28 21-28s21 11 21 28v16c0 17-9 29-21 29S39 81 39 64V48Z" fill="#fff" opacity=".96" />
                    <path d="M34 44c5-23 16-34 26-34 14 0 25 12 29 34-9-8-18-12-29-12-10 0-18 4-26 12Z" fill="currentColor" />
                    <path d="M31 91c9 10 18 15 29 15s20-5 29-15l13 41H18l13-41Z" fill="currentColor" />
                  </svg>
                </div>

                <div class="kartu-data">
                  <div class="data-baris">
                    <span>Nama</span><i>:</i>
                    <b class="data-nama">{{ s.full_name }}</b>
                  </div>
                  <div class="data-baris">
                    <span>Tempat,<br />Tgl Lahir</span><i>:</i>
                    <b>{{ birthInfo(s) }}</b>
                  </div>
                  <div class="data-baris">
                    <span>NISN</span><i>:</i>
                    <b>{{ s.student_id }}</b>
                  </div>
                  <div class="data-baris">
                    <span>Alamat</span><i>:</i>
                    <b class="data-alamat">{{ s.address || '-' }}</b>
                  </div>
                </div>

              </div>

              <div class="kartu-footer">BELAJAR • BERKARAKTER • BERPRESTASI</div>

            </div>

        <div class="kartu kartu-belakang">

              <div class="belakang-atas">
                <div class="belakang-judul">KARTU ABSENSI SISWA</div>
              </div>

              <div class="kode-panel">
                <img
                  v-if="codeMap[s.student_id]"
                  :src="codeMap[s.student_id]"
                  :alt="`Kode ${s.full_name}`"
                  :class="mode === 'qr' ? 'kode-qr' : 'kode-barcode'"
                />
                <div v-else class="kode-error">Kode tidak tersedia</div>
              </div>

              <p class="kode-teks">{{ codeValue(s) }}</p>

            </div>

      </div>
    </div>

  </div>
</template>

<style>
/* ============================
   TEMA WARNA (dari logo SDN 096/VIII Sumber Agung)
   Navy  : perisai & pita
   Emas  : daun, obor, bingkai
   Oranye: api obor
   Hijau : daun kapas
============================ */

.kartu {
  --navy: #0b1f4b;
  --navy-2: #173a7a;
  --gold: #c9972b;
  --gold-light: #f2d27a;
  --orange: #f08a24;
  --green: #2e7d32;
  --cream: #fffdf6;
}

/* Preview layar: kartu yang sama, diperbesar */
.preview-pair {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 5mm;
  zoom: 1.3;
}

.print-area {
  display: none;
}

.kartu-baris {
  display: flex;
  flex-wrap: nowrap;
  gap: 5mm;
  width: 100%;
}

.kartu {
  position: relative;
  display: flex;
  width: 54mm;
  height: 85.6mm;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 3mm;
  background: var(--cream);
  color: var(--navy);
  font-family: Arial, Helvetica, sans-serif;
  text-align: center;
  box-shadow: 0 0 0 0.35mm var(--gold) inset;
}

/* ---------- DEPAN ---------- */

.kartu-depan {
  background:
    radial-gradient(circle at 0% 100%, rgba(201, 151, 43, 0.22), transparent 45%),
    radial-gradient(circle at 100% 45%, rgba(23, 58, 122, 0.10), transparent 45%),
    var(--cream);
}

.kartu-header {
  position: relative;
  display: flex;
  width: 100%;
  height: 17mm;
  flex-shrink: 0;
  align-items: center;
  box-sizing: border-box;
  padding: 1.8mm 2.5mm;
  background:
    radial-gradient(circle at 100% 0%, rgba(242, 210, 122, 0.35), transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(240, 138, 36, 0.25), transparent 45%),
    linear-gradient(160deg, var(--navy), var(--navy-2));
  border-bottom: 0.9mm solid var(--gold);
  color: #ffffff;
}

.kop-identitas {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 11mm minmax(0, 1fr);
  align-items: center;
  column-gap: 2mm;
}

.kop-teks {
  min-width: 0;
  width: 100%;
  text-align: center;
}

.kartu-sekolah {
  font-size: 2.65mm;
  font-weight: 900;
  letter-spacing: 0.08mm;
  line-height: 1.25;
  text-transform: uppercase;
}

.kartu-npsn {
  margin-top: 1mm;
  color: var(--gold-light);
  font-size: 2mm;
  font-weight: 700;
  letter-spacing: 0.25mm;
}

.kop-logo,
.kop-logo-fallback {
  display: flex;
  width: 11mm;
  height: 11mm;
  flex: 0 0 11mm;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 0.3mm solid rgba(255,255,255,.7);
  border-radius: 1.2mm;
  background: #fff;
  object-fit: contain;
  padding: .5mm;
}

.kop-logo-fallback {
  color: var(--navy);
}

.kartu-header::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -0.9mm;
  left: 0;
  height: 0.3mm;
  background: var(--orange);
}

.kartu-isi {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  padding: 3mm 3.5mm 0;
  overflow: hidden;
}

.kartu-foto-siswa {
  display: flex;
  width: 25mm;
  height: 25mm;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: var(--navy);
}

.kartu-foto-siswa svg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.kartu-data {
  display: flex;
  width: 100%;
  margin-top: 2.5mm;
  flex-direction: column;
  gap: 1.6mm;
  text-align: left;
}

.data-baris {
  display: grid;
  grid-template-columns: 15mm 2mm 1fr;
  align-items: start;
  font-size: 2.4mm;
  line-height: 1.3;
}

.data-baris span {
  color: #64748b;
  font-weight: 700;
}

.data-baris i {
  color: #64748b;
  font-style: normal;
}

.data-baris b {
  color: var(--navy);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.data-nama,
.data-alamat {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.data-nama {
  -webkit-line-clamp: 2;
}

.data-alamat {
  -webkit-line-clamp: 3;
}

.kartu-footer {
  display: flex;
  width: 100%;
  height: 4.8mm;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  background: linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold));
  color: var(--navy);
  font-size: 1.7mm;
  font-weight: 900;
  letter-spacing: 0.25mm;
}

/* ---------- BELAKANG ---------- */

.kartu-belakang {
  justify-content: center;
  gap: 4.5mm;
  box-sizing: border-box;
  padding: 4.5mm 4mm 4mm;
  background:
    radial-gradient(circle at 100% 0%, rgba(242, 210, 122, 0.30), transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(240, 138, 36, 0.22), transparent 45%),
    linear-gradient(165deg, var(--navy), var(--navy-2));
  color: #ffffff;
}

.kartu-belakang::before {
  content: '';
  position: absolute;
  inset: 1.8mm;
  border: 0.35mm solid var(--gold);
  border-radius: 2mm;
  pointer-events: none;
}

.belakang-atas {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5mm;
}

.belakang-judul {
  color: var(--gold-light);
  font-size: 2.3mm;
  font-weight: 900;
  letter-spacing: 0.5mm;
}

/* Panel putih menjaga kontras kode agar mudah dipindai */
.kode-panel {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 2mm;
  border: 0.4mm solid var(--gold);
  border-radius: 2mm;
  background: #ffffff;
}

.kode-qr {
  display: block;
  width: 34mm;
  height: 34mm;
  object-fit: contain;
}

.kode-barcode {
  display: block;
  width: 40mm;
  height: 20mm;
  object-fit: fill;
}

.kode-error {
  color: #dc2626;
  font-size: 3mm;
}

.kode-teks {
  margin: 0;
  color: var(--gold-light);
  font-size: 3mm;
  font-weight: 900;
  letter-spacing: 0.8mm;
}

/* ============================
   PRINT SETTINGS - A4
   Pasangan depan+belakang = 54 + 5 + 54 = 113 mm lebar,
   tinggi 85,6 mm, 3 pasang per halaman.
============================ */

@media print {
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  html,
  body {
    width: 194mm !important;
    min-width: 194mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body * {
    visibility: hidden !important;
  }

  .no-print {
    display: none !important;
  }

  .student-card-page {
    display: block !important;
    width: 194mm !important;
    min-width: 194mm !important;
    max-width: 194mm !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .print-area,
  .print-area * {
    visibility: visible !important;
  }

  .print-area {
    display: grid !important;
    position: static !important;
    width: 194mm !important;
    min-width: 194mm !important;
    max-width: 194mm !important;
    grid-template-columns: 1fr !important;
    grid-auto-rows: 85.6mm !important;
    row-gap: 5mm !important;
    column-gap: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }

  .kartu-baris {
    display: grid !important;
    width: 194mm !important;
    height: 85.6mm !important;
    min-height: 85.6mm !important;
    max-height: 85.6mm !important;
    grid-template-columns: 54mm 54mm !important;
    column-gap: 5mm !important;
    row-gap: 0 !important;
    justify-content: center !important;
    align-items: start !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .kartu-baris.page-break {
    break-after: page !important;
    page-break-after: always !important;
  }

  .kartu {
    display: flex !important;
    position: relative !important;
    width: 54mm !important;
    min-width: 54mm !important;
    max-width: 54mm !important;
    height: 85.6mm !important;
    min-height: 85.6mm !important;
    max-height: 85.6mm !important;
    flex: none !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    overflow: hidden !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* Pastikan warna latar & gradasi ikut tercetak */
  .kartu,
  .kartu * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .kartu-logo img,
  .kode-panel img {
    display: block !important;
  }

  .kode-qr {
    width: 34mm !important;
    height: 34mm !important;
  }

  .kode-barcode {
    width: 40mm !important;
    height: 20mm !important;
  }
}

@media screen and (max-width: 640px) {
  .student-card-page {
    min-width: 0;
    width: 100%;
  }

  .preview-pair {
    zoom: 1;
  }
}
</style>