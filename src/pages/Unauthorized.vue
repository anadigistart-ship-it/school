<script setup>
import { ShieldAlert } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="mx-auto max-w-md py-16 text-center">
    <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert class="h-7 w-7" /></div>
    <h1 class="mt-5 text-2xl font-bold text-navy-900">Access denied</h1>
    <p class="mt-2 text-slate-500">Your account does not have permission to view this page.</p>
    <RouterLink :to="auth.homePath" class="btn-primary mt-6">Go to my dashboard</RouterLink>
  </div>
</template>
