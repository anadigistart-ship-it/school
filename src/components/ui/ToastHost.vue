<script setup>
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
    <div
      v-for="t in toast.items"
      :key="t.id"
      role="status"
      class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-lg"
      :class="styles[t.type]"
    >
      <component :is="icons[t.type]" class="mt-0.5 h-5 w-5 shrink-0" />
      <p class="flex-1 text-sm font-medium">{{ t.message }}</p>
      <button class="rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2" aria-label="Dismiss" @click="toast.dismiss(t.id)">
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
