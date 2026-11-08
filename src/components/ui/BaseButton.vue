<script setup>
import { Loader2 } from 'lucide-vue-next'

defineProps({
  loading: Boolean,
  variant: { type: String, default: 'primary' },
  type: { type: String, default: 'button' },
  disabled: Boolean,
})
</script>

<template>
  <button :type="type" :disabled="disabled || loading" :aria-busy="loading" :class="variant === 'primary' ? 'btn-primary' : 'btn-secondary'">
    <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
    <slot />
  </button>
</template>
