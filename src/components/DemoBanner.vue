<script setup>
import { FlaskConical } from 'lucide-vue-next'
import { IS_DEMO } from '@/config'
</script>

<template>
  <div v-if="IS_DEMO" class="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-950">
    <FlaskConical class="h-3.5 w-3.5" />
    DEMO MODE: sample data only, nothing is saved to Google Sheets
  </div>
</template>
