<template>
  <div class="app">
    <header class="site-header">
      <h1>胡张驰（Zhangchi Hu）</h1>
      <a href="https://ricepastem.cafe/" target="_blank" rel="noopener noreferrer">[{{ t('resume.personalSite') }}]</a>
    </header>
    <main><NuxtPage /></main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
const { t, initLocale } = useI18n()
const { initDarkMode } = useDarkMode()
onMounted(() => { initLocale(); initDarkMode() })
</script>

<style>
.site-header { min-height: 70px; padding: 12px 24px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--color-border); font-family: ui-monospace, monospace; }
.site-header h1 { margin: 0; font: inherit; font-weight: 600; }
.site-header a { color: var(--color-text-primary); text-decoration: none; margin-left: auto; }
.site-header a:hover { text-decoration: underline; text-underline-offset: 4px; }
</style>
