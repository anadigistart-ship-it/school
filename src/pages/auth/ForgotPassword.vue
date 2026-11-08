<script setup>
import { ref } from 'vue'
import { ArrowLeft, User, MailCheck } from 'lucide-vue-next'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { authApi } from '@/api/auth'

const identifier = ref('')
const error = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  error.value = ''
  if (!identifier.value.trim()) { error.value = 'Masukkan username, email, atau NIS Anda.'; return }
  loading.value = true
  try {
    await authApi.requestPasswordReset(identifier.value.trim())
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <RouterLink to="/login" class="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
      <ArrowLeft class="h-4 w-4" /> Kembali ke halaman masuk
    </RouterLink>

    <template v-if="!sent">
      <h1 class="text-2xl font-bold text-navy-900">Lupa kata sandi</h1>
      <p class="mt-1.5 text-sm text-slate-500">Masukkan identitas akun Anda dan kami akan memberi tahu administrator sekolah untuk mereset kata sandi.</p>
      <form class="mt-6 space-y-5" novalidate @submit.prevent="submit">
        <BaseInput v-model="identifier" label="Username, email, atau NIS" :icon="User" autocomplete="username" :error="error" :disabled="loading" />
        <BaseButton type="submit" class="w-full" :loading="loading">Minta reset</BaseButton>
      </form>
    </template>

    <div v-else class="text-center">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><MailCheck class="h-6 w-6" /></div>
      <h1 class="mt-4 text-xl font-bold text-navy-900">Permintaan diterima</h1>
      <p class="mt-2 text-sm text-slate-500">Jika akun ditemukan, administrator akan diberi tahu. Demi keamanan, kami tidak menyebutkan apakah akun tersebut ada.</p>
    </div>
  </div>
</template>