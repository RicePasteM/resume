<template>
  <div class="app">
    <main><NuxtPage /></main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
const { initDarkMode } = useDarkMode()
onMounted(() => { initDarkMode() })
</script>
