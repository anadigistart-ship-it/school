<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock } from 'lucide-vue-next'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

const form = reactive({ current: '', next: '', confirm: '' })
const errors = reactive({ current: '', next: '', confirm: '' })
const formError = ref('')
const loading = ref(false)

function validate() {
  errors.current = form.current ? '' : 'Enter your current password.'
  if (form.next.length < 8) errors.next = 'Use at least 8 characters.'
  else if (!/[A-Za-z]/.test(form.next) || !/\d/.test(form.next)) errors.next = 'Include at least one letter and one number.'
  else if (form.next === form.current) errors.next = 'New password must differ from the current one.'
  else errors.next = ''
  errors.confirm = form.confirm === form.next ? '' : 'Passwords do not match.'
  return !errors.current && !errors.next && !errors.confirm
}

async function submit() {
  formError.value = ''
  if (!validate()) return
  loading.value = true
  try {
    await auth.changePassword(form.current, form.next)
    // Server revokes all sessions on password change, so sign in again.
    auth.clearSession()
    toast.success('Password changed. Please sign in again.')
    router.replace('/login')
  } catch (e) {
    if (e.code === 'UNAUTHENTICATED') { auth.clearSession(); router.replace('/login'); return }
    formError.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <h1 class="text-2xl font-bold text-navy-900">Change password</h1>
    <p class="mt-1 text-sm text-slate-500">You will be signed out on all devices after changing it.</p>
    <form class="card mt-6 space-y-5 p-6" novalidate @submit.prevent="submit">
      <p v-if="formError" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ formError }}</p>
      <BaseInput v-model="form.current" label="Current password" type="password" autocomplete="current-password" :icon="Lock" :error="errors.current" :disabled="loading" />
      <BaseInput v-model="form.next" label="New password" type="password" autocomplete="new-password" :icon="Lock" :error="errors.next" hint="At least 8 characters, with a letter and a number." :disabled="loading" />
      <BaseInput v-model="form.confirm" label="Confirm new password" type="password" autocomplete="new-password" :icon="Lock" :error="errors.confirm" :disabled="loading" />
      <BaseButton type="submit" class="w-full" :loading="loading">Update password</BaseButton>
    </form>
  </div>
</template>
