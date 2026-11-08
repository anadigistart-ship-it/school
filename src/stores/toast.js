import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
  const items = ref([])
  let seq = 0

  function push(type, message, timeout = 4500) {
    const id = ++seq
    items.value.push({ id, type, message })
    if (timeout) setTimeout(() => dismiss(id), timeout)
  }
  const dismiss = (id) => { items.value = items.value.filter((t) => t.id !== id) }

  return {
    items, dismiss,
    success: (m) => push('success', m),
    error: (m) => push('error', m, 6500),
    warning: (m) => push('warning', m),
    info: (m) => push('info', m),
  }
})
