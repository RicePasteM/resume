<template>
  <div class="app">
    <main><NuxtPage /></main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
const { initLocale } = useI18n()
const { initDarkMode } = useDarkMode()
onMounted(() => { initLocale(); initDarkMode() })
</script>
