<template>
  <el-input
    v-model="input"
    style="width: 240px"
    :placeholder="placeholder"
    :formatter="formatter"
    :parser="parser"
    @input="(emit('update:modelValue', input), console.log('emit', input))"
    :onkeypress="inputType === 'number' ? `return /[0-9.,]/.test(event.key)` : undefined"
  />
</template>

<script lang="ts" setup>
import { ref, defineProps, defineEmits, watch } from 'vue'
import { ElInput } from 'element-plus'

// รับ props และ emit
const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: '',
  },
  inputType: {
    type: String,
    default: 'text',
  },
  placeholder: {
    type: String,
    default: 'Please input',
  },
})

const emit = defineEmits(['update:modelValue'])
const input = ref(props.modelValue)

watch(
  () => props.modelValue,
  (newValue) => {
    input.value = String(newValue)
  },
)

const formatter = (value: string) => {
  if (!value) return ''
  if (props.inputType === 'number') {
    return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  return value
}

const parser = (value: string) => {
  if (!value) return ''
  if (props.inputType === 'number') {
    return value.replace(/\$\s?|(,*)/g, '')
  }
  return value
}
</script>
