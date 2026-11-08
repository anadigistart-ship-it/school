<script setup>
import { ref, computed, useId } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
  icon: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'blur'])

const id = useId()
const show = ref(false)
const isPassword = computed(() => props.type === 'password')
const inputType = computed(() => (isPassword.value && show.value ? 'text' : props.type))
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-sm font-medium text-slate-700">{{ label }}</label>
    <div class="relative">
      <component :is="icon" v-if="icon" class="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
      <input
        :id="id"
        :type="inputType"
        :value="modelValue"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="!!error"
        :aria-describedby="error ? id + '-err' : hint ? id + '-hint' : undefined"
        class="input-base"
        :class="[error && 'input-error', icon && 'pl-10', isPassword && 'pr-11']"
        @input="emit('update:modelValue', $event.target.value)"
        @blur="emit('blur')"
      />
      <button
        v-if="isPassword"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500"
        :aria-label="show ? 'Hide password' : 'Show password'"
        :aria-pressed="show"
        @click="show = !show"
      >
        <EyeOff v-if="show" class="h-4.5 w-4.5" />
        <Eye v-else class="h-4.5 w-4.5" />
      </button>
    </div>
    <p v-if="error" :id="id + '-err'" class="mt-1.5 text-sm text-red-600" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="id + '-hint'" class="mt-1.5 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
