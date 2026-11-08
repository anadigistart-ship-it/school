<script setup>
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-slate-50 px-6">
    <div class="max-w-md text-center">
      <p class="text-6xl font-bold text-royal-600">404</p>
      <h1 class="mt-3 text-2xl font-bold text-navy-900">Page not found</h1>
      <p class="mt-2 text-slate-500">The page you are looking for does not exist or has moved.</p>
      <RouterLink :to="auth.isAuthenticated ? auth.homePath : '/login'" class="btn-primary mt-6">
        {{ auth.isAuthenticated ? 'Back to dashboard' : 'Go to sign in' }}
      </RouterLink>
    </div>
  </div>
</template>
