<script setup>
import { useRoute } from 'vue-router'
import { Hammer } from 'lucide-vue-next'

const route = useRoute()
</script>

<template>
  <div class="mx-auto max-w-xl py-16 text-center">
    <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-600"><Hammer class="h-7 w-7" /></div>
    <h1 class="mt-5 text-2xl font-bold text-navy-900">{{ route.meta.title }}</h1>
    <p class="mt-2 text-slate-500">This page is built in Phase {{ route.meta.phase }}. Access control for it is already enforced.</p>
  </div>
</template>
