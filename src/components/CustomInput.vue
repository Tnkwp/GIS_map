<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Cleave from 'cleave.js'
import 'cleave.js/dist/addons/cleave-phone.us'

interface CleaveEvent {
  target: {
    value: string
    rawValue: string
  }
}

const price = ref<string>('')
const inputRef = ref<HTMLInputElement | null>(null)
let cleaveInstance: Cleave | null = null

onMounted(() => {
  if (inputRef.value) {
    cleaveInstance = new Cleave(inputRef.value, {
      numeral: true,
      numeralDecimalMark: '.',
      delimiter: ',',
      numeralDecimalScale: 2,
      numeralThousandsGroupStyle: 'thousand',
      onValueChanged: (e: CleaveEvent) => {
        price.value = e.target.value
      },
    })

    // Set initial value
    if (cleaveInstance) {
      inputRef.value.value = price.value
    }
  }
})

const onBlur = () => {
  if (inputRef.value) {
    const inputValue = inputRef.value.value.trim()

    // If input is empty, reset both price and input value
    if (!inputValue) {
      price.value = ''
      inputRef.value.value = ''
      return
    }

    const numValue = parseFloat(inputValue.replace(/,/g, '') || '0')
    price.value = numValue.toFixed(2)
    inputRef.value.value = numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
}
</script>

<template>
  <div>
    <input placeholder="0.00" ref="inputRef" @blur="onBlur" />
    <div class="mt-2">Value: {{ price }}</div>
  </div>
</template>

<style scoped>
.mt-2 {
  margin-top: 0.5rem;
}
</style>
