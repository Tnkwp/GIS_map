<script setup lang="ts">
import { ref } from 'vue'
import { formatNumber } from '@/utils/general'

const numberInput = ref(formatNumber(10000))
</script>

<template>
  Number
  {{ numberInput }}
  <custom-input></custom-input>
</template>
