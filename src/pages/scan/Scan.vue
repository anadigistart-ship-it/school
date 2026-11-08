<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, CameraOff, CheckCircle2, Clock, AlertCircle, Keyboard } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { attendanceApi } from '@/api/attendance'

const READER_ID = 'qr-reader'
const STATUS_LABEL = { hadir: 'Hadir', terlambat: 'Terlambat' }
const FLASH_MS = 2200

let scanner = null
let busy = false
let lastCode = ''
let lastAt = 0
let flashTimer = null
let audioCtx = null

const running = ref(false)
const starting = ref(false)
const cameraError = ref('')
const result = ref(null) // { type: 'success' | 'late' | 'already' | 'error', title, detail }
const flash = ref(null) // animasi di atas kamera: { type, label, title, detail, key }
const history = ref([])
const manual = ref('')
const manualLoading = ref(false)

const frameState = computed(() => flash.value?.type || 'idle')

// ---------- Suara & getar ----------
function ensureAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC && !audioCtx) audioCtx = new AC()
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
  } catch { /* abaikan */ }
}

function tone(freq, start, dur, type = 'sine') {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  const t0 = audioCtx.currentTime + start
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function feedback(type) {
  try {
    if (navigator.vibrate) navigator.vibrate(type === 'error' ? [80, 60, 80] : 80)
  } catch { /* abaikan */ }
  if (type === 'success') {
    tone(880, 0, 0.12)
    tone(1320, 0.12, 0.2)
  } else if (type === 'error') {
    tone(220, 0, 0.3, 'square')
  } else {
    tone(660, 0, 0.18)
  }
}

// ---------- Animasi hasil di atas kamera ----------
function showFlash(type, label, title, detail) {
  flash.value = { type, label, title, detail, key: Date.now() }
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flash.value = null }, FLASH_MS)
}

// ---------- Proses kode hasil scan ----------
async function handleCode(raw, source) {
  const code = String(raw || '').trim()
  if (!code || busy) return
  // Cegah scan ganda untuk kode yang sama dalam 4 detik.
  if (code === lastCode && Date.now() - lastAt < 4000) return

  busy = true
  try {
    const info = await attendanceApi.scan(code, source)
    const status = STATUS_LABEL[info.attendance_status] || info.attendance_status

    if (info.already) {
      const detail = `${info.class_name} · ${status}, ${info.check_in_time}`
      result.value = { type: 'already', title: info.full_name, detail: `${info.class_name} · Sudah absen hari ini (${status}, ${info.check_in_time})` }
      showFlash('already', 'Sudah Absen', info.full_name, detail)
      feedback('already')
    } else {
      const late = info.attendance_status === 'terlambat'
      const type = late ? 'late' : 'success'
      const detail = `${info.class_name} · ${status} pukul ${info.check_in_time}`
      result.value = { type, title: info.full_name, detail }
      showFlash(type, late ? 'Absensi Tercatat (Terlambat)' : 'Absensi Berhasil', info.full_name, detail)
      feedback(type)
      history.value.unshift({
        key: `${info.student_id}-${Date.now()}`,
        name: info.full_name,
        className: info.class_name,
        status,
        time: info.check_in_time,
        late,
      })
      history.value = history.value.slice(0, 15)
    }
  } catch (e) {
    result.value = { type: 'error', title: 'Gagal mencatat', detail: e.message }
    showFlash('error', 'Gagal', 'Absensi tidak tercatat', e.message)
    feedback('error')
  } finally {
    lastCode = code
    lastAt = Date.now()
    busy = false
  }
}

// ---------- Kamera ----------
async function startCamera() {
  cameraError.value = ''
  starting.value = true
  ensureAudio() // harus dipanggil dari klik pengguna agar suara diizinkan browser
  try {
    scanner = new Html5Qrcode(READER_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
      ],
      verbose: false,
    })
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        aspectRatio: 1, // tampilan persegi, cocok dengan bingkai
        // Area baca = 70% sisi terpendek, sama dengan ukuran bingkai di layar.
        qrbox: (w, h) => {
          const s = Math.floor(Math.min(w, h) * 0.7)
          return { width: s, height: s }
        },
      },
      (text) => handleCode(text, 'camera'),
      () => {}, // error per-frame (tidak ada kode terbaca) diabaikan
    )
    running.value = true
  } catch (e) {
    scanner = null
    const msg = String(e?.message || e)
    if (/permission|denied|NotAllowed/i.test(msg)) {
      cameraError.value = 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.'
    } else if (/secure|https/i.test(msg) || !window.isSecureContext) {
      cameraError.value = 'Kamera hanya bisa dipakai lewat HTTPS (atau localhost). Buka aplikasi lewat alamat HTTPS.'
    } else {
      cameraError.value = 'Kamera tidak dapat dibuka: ' + msg
    }
  } finally {
    starting.value = false
  }
}

async function stopCamera() {
  clearTimeout(flashTimer)
  flash.value = null
  if (!scanner) return
  try {
    if (running.value) await scanner.stop()
    scanner.clear()
  } catch { /* abaikan */ }
  scanner = null
  running.value = false
}

async function submitManual() {
  if (!manual.value.trim()) return
  ensureAudio()
  manualLoading.value = true
  lastCode = '' // input manual selalu diproses
  await handleCode(manual.value, 'scanner')
  manual.value = ''
  manualLoading.value = false
}

onBeforeUnmount(() => {
  stopCamera()
  try { if (audioCtx) audioCtx.close() } catch { /* abaikan */ }
})

const RESULT_STYLE = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  late: 'border-amber-200 bg-amber-50 text-amber-900',
  already: 'border-blue-200 bg-blue-50 text-blue-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-navy-900">Pindai Absensi</h1>
      <p class="mt-1 text-sm text-slate-500">Arahkan kamera ke QR code pada kartu siswa.</p>
    </div>

    <div class="card p-4">
      <div class="scan-stage">
        <!-- Video kamera (selalu ada di halaman agar ukurannya terbaca) -->
        <div :id="READER_ID" class="scan-reader"></div>

        <!-- Tampilan saat kamera belum aktif -->
        <div v-if="!running" class="scan-placeholder">
          <div>
            <CameraOff class="mx-auto h-10 w-10 opacity-60" />
            <p class="mt-2 text-sm">Kamera belum aktif</p>
          </div>
        </div>

        <!-- Bingkai pemindai -->
        <div v-if="running" class="scan-overlay" :data-state="frameState" aria-hidden="true">
          <div class="scan-frame">
            <span class="c tl"></span><span class="c tr"></span>
            <span class="c bl"></span><span class="c br"></span>
            <span v-if="!flash" class="scan-line"></span>
          </div>
          <p class="scan-hint">Posisikan QR code di dalam bingkai</p>
        </div>

        <!-- Animasi hasil absensi -->
        <Transition name="scan-fade">
          <div v-if="flash" :key="flash.key" class="scan-flash" :data-type="flash.type" role="status" aria-live="assertive">
            <div class="scan-icon-wrap">
              <svg class="scan-icon" viewBox="0 0 52 52" aria-hidden="true">
                <circle class="scan-icon-circle" cx="26" cy="26" r="24" fill="none" />
                <path v-if="flash.type === 'error'" class="scan-icon-mark" fill="none" d="M17 17 L35 35 M35 17 L17 35" />
                <path v-else-if="flash.type === 'already'" class="scan-icon-mark" fill="none" d="M26 23 V37 M26 15 V17" />
                <path v-else class="scan-icon-mark" fill="none" d="M15 27 L23 35 L38 18" />
              </svg>
            </div>
            <p class="scan-flash-label">{{ flash.label }}</p>
            <p class="scan-flash-title">{{ flash.title }}</p>
            <p class="scan-flash-detail">{{ flash.detail }}</p>
          </div>
        </Transition>
      </div>

      <p v-if="cameraError" class="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" /> <span>{{ cameraError }}</span>
      </p>

      <div class="mt-4">
        <BaseButton v-if="!running" class="w-full" :loading="starting" @click="startCamera">
          <Camera class="mr-2 h-4 w-4" /> Aktifkan kamera
        </BaseButton>
        <BaseButton v-else class="w-full" @click="stopCamera">Matikan kamera</BaseButton>
      </div>
    </div>

    <!-- Hasil scan terakhir -->
    <div v-if="result" class="flex items-start gap-3 rounded-xl border p-4" :class="RESULT_STYLE[result.type]" role="status" aria-live="polite">
      <AlertCircle v-if="result.type === 'error'" class="mt-0.5 h-5 w-5 shrink-0" />
      <Clock v-else-if="result.type === 'late' || result.type === 'already'" class="mt-0.5 h-5 w-5 shrink-0" />
      <CheckCircle2 v-else class="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p class="font-semibold">{{ result.title }}</p>
        <p class="text-sm">{{ result.detail }}</p>
      </div>
    </div>

    <!-- Input manual -->
    <form class="card flex items-center gap-2 p-4" @submit.prevent="submitManual">
      <Keyboard class="h-5 w-5 shrink-0 text-slate-400" />
      <input
        v-model="manual"
        type="text"
        class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
        placeholder="Ketik NIS / nilai barcode jika kamera bermasalah"
        autocomplete="off"
      />
      <BaseButton type="submit" :loading="manualLoading">Catat</BaseButton>
    </form>

    <!-- Riwayat sesi ini -->
    <div v-if="history.length" class="card p-4">
      <p class="text-sm font-semibold text-slate-800">Tercatat di sesi ini ({{ history.length }})</p>
      <ul class="mt-3 divide-y divide-slate-100">
        <li v-for="h in history" :key="h.key" class="flex items-center justify-between py-2 text-sm">
          <span>
            <span class="font-medium text-slate-800">{{ h.name }}</span>
            <span class="ml-2 text-slate-500">{{ h.className }}</span>
          </span>
          <span :class="h.late ? 'text-amber-700' : 'text-emerald-700'">{{ h.status }} · {{ h.time }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style>
/* ===== Area kamera ===== */
.scan-stage {
  position: relative; width: 100%; max-width: 28rem; margin: 0 auto;
  aspect-ratio: 1 / 1; overflow: hidden; border-radius: 0.875rem; background: #0f172a;
}
.scan-reader { position: absolute; inset: 0; border: none !important; }
.scan-reader #qr-reader__scan_region { height: 100% !important; min-height: 0 !important; }
.scan-reader video { width: 100% !important; height: 100% !important; object-fit: cover; }
/* Sembunyikan kotak bawaan library; diganti bingkai buatan sendiri. */
.scan-reader #qr-shaded-region { display: none !important; }

.scan-placeholder {
  position: absolute; inset: 0; display: grid; place-items: center;
  text-align: center; color: #cbd5e1;
}

/* ===== Bingkai pemindai ===== */
.scan-overlay {
  position: absolute; inset: 0; display: grid; place-items: center;
  pointer-events: none; color: #ffffff; transition: color 0.2s;
}
.scan-overlay[data-state='success'] { color: #34d399; }
.scan-overlay[data-state='late'] { color: #fbbf24; }
.scan-overlay[data-state='already'] { color: #60a5fa; }
.scan-overlay[data-state='error'] { color: #f87171; }

.scan-frame {
  position: relative; width: 70%; aspect-ratio: 1 / 1; border-radius: 1rem;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55); /* menggelapkan area di luar bingkai */
}
.scan-frame .c { position: absolute; width: 2.25rem; height: 2.25rem; border: 0 solid currentColor; }
.scan-frame .tl { top: 0; left: 0; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 1rem; }
.scan-frame .tr { top: 0; right: 0; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 1rem; }
.scan-frame .bl { bottom: 0; left: 0; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 1rem; }
.scan-frame .br { bottom: 0; right: 0; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 1rem; }

.scan-line {
  position: absolute; left: 6%; right: 6%; top: 4%; height: 3px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, #60a5fa, transparent);
  box-shadow: 0 0 12px #60a5fa;
  animation: scan-sweep 2s ease-in-out infinite;
}
@keyframes scan-sweep {
  0% { top: 4%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 96%; opacity: 0; }
}

.scan-hint {
  position: absolute; left: 0; right: 0; bottom: 0.75rem; margin: 0;
  text-align: center; font-size: 0.8rem; color: #e2e8f0;
}

/* ===== Animasi hasil absensi ===== */
.scan-flash {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.2rem;
  padding: 1rem; text-align: center; color: #ffffff;
}
.scan-flash[data-type='success'] { background: rgba(5, 150, 105, 0.94); }
.scan-flash[data-type='late'] { background: rgba(217, 119, 6, 0.94); }
.scan-flash[data-type='already'] { background: rgba(37, 99, 235, 0.94); }
.scan-flash[data-type='error'] { background: rgba(220, 38, 38, 0.94); }

.scan-icon-wrap { position: relative; width: 5.5rem; height: 5.5rem; margin-bottom: 0.5rem; }
.scan-icon-wrap::before {
  content: ''; position: absolute; inset: 0; border-radius: 9999px;
  border: 3px solid rgba(255, 255, 255, 0.6);
  animation: scan-ring 0.9s ease-out 0.4s both;
}
.scan-icon {
  width: 100%; height: 100%; stroke: #ffffff; stroke-width: 3;
  stroke-linecap: round; stroke-linejoin: round;
  animation: scan-pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.scan-icon-circle { stroke-dasharray: 151; stroke-dashoffset: 151; animation: scan-draw 0.5s ease forwards; }
.scan-icon-mark { stroke-dasharray: 40; stroke-dashoffset: 40; animation: scan-draw 0.35s ease 0.35s forwards; }

@keyframes scan-draw { to { stroke-dashoffset: 0; } }
@keyframes scan-pop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes scan-ring { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.7); opacity: 0; } }

.scan-flash-label { margin: 0; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.9; }
.scan-flash-title { margin: 0; font-size: 1.35rem; font-weight: 700; line-height: 1.2; }
.scan-flash-detail { margin: 0; font-size: 0.9rem; opacity: 0.95; }

.scan-fade-enter-active { transition: opacity 0.2s ease; }
.scan-fade-leave-active { transition: opacity 0.35s ease; }
.scan-fade-enter-from, .scan-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .scan-line { display: none; }
  .scan-icon, .scan-icon-circle, .scan-icon-mark, .scan-icon-wrap::before { animation-duration: 0.01s; animation-delay: 0s; }
}
</style>
