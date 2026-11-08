<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock, AlertCircle, Info } from 'lucide-vue-next'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { IS_DEMO } from '@/config'

const auth = useAuthStore()
const toast = useToastStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ identifier: '', password: '' })
const errors = reactive({ identifier: '', password: '' })
const formError = ref('')

function validate() {
  errors.identifier = form.identifier.trim() ? '' : 'Masukkan username, email, atau NIS Anda.'
  errors.password = form.password ? '' : 'Masukkan kata sandi Anda.'
  return !errors.identifier && !errors.password
}

// Hanya izinkan pengalihan relatif di dalam aplikasi (mencegah open redirect).
function safeRedirect(target, fallback) {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : fallback
}

async function submit() {
  formError.value = ''
  if (!validate()) return
  try {
    const user = await auth.login(form.identifier.trim(), form.password)
    toast.success(`Selamat datang kembali, ${user.full_name.split(' ')[0]}.`)
    // Pengalihan berdasarkan peran: deep link hanya dipakai jika router mengizinkan peran ini membukanya.
    const target = safeRedirect(route.query.redirect, null)
    if (target) {
      const resolved = router.resolve(target)
      const allowed = resolved.matched.flatMap((r) => r.meta.roles || [])
      if (!allowed.length || allowed.includes(user.role)) return router.replace(target)
    }
    router.replace(auth.homePath)
  } catch (e) {
    form.password = ''
    formError.value = e.message
  }
}

function fill(username) {
  form.identifier = username
  form.password = 'demo1234'
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h1 class="text-2xl font-bold text-navy-900">Masuk</h1>
    <p class="mt-1.5 text-sm text-slate-500">Gunakan username, alamat email, atau NIS Anda.</p>

    <div v-if="formError" class="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <AlertCircle class="mt-0.5 h-4.5 w-4.5 shrink-0" />
      <span>{{ formError }}</span>
    </div>

    <form class="mt-6 space-y-5" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="form.identifier"
        label="Username, email, atau NIS"
        autocomplete="username"
        :icon="User"
        :error="errors.identifier"
        :disabled="auth.loading"
        @blur="errors.identifier = form.identifier.trim() ? '' : errors.identifier"
      />
      <BaseInput
        v-model="form.password"
        label="Kata sandi"
        type="password"
        autocomplete="current-password"
        :icon="Lock"
        :error="errors.password"
        :disabled="auth.loading"
      />
      <div class="flex justify-end">
        <RouterLink to="/forgot-password" class="text-sm font-medium text-royal-600 hover:text-royal-700 focus:outline-none focus-visible:underline">
          Lupa kata sandi?
        </RouterLink>
      </div>
      <BaseButton type="submit" class="w-full" :loading="auth.loading">
        {{ auth.loading ? 'Sedang masuk…' : 'Masuk' }}
      </BaseButton>
    </form>

    <div v-if="IS_DEMO" class="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-900">
      <p class="flex items-center gap-1.5 font-semibold"><Info class="h-4 w-4" /> Akun demo</p>
      <p class="mt-1 text-blue-800">Kata sandi untuk semua akun: <code class="rounded bg-white px-1">demo1234</code></p>
      <div class="mt-2.5 flex flex-wrap gap-2">
        <button v-for="u in ['admin', 'teacher', 'student']" :key="u" type="button"
          class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold capitalize text-royal-700 ring-1 ring-blue-200 hover:bg-blue-100"
          @click="fill(u)">{{ u }}</button>
      </div>
    </div>
  </div>
</template>