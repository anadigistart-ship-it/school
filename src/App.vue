<script setup>
import ToastHost from '@/components/ui/ToastHost.vue'
import DemoBanner from '@/components/DemoBanner.vue'
</script>

<template>
  <DemoBanner />
  <RouterView />
  <ToastHost />
</template>
