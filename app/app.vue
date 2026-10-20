<template>
  <div class="app">
    <header class="site-header">
      <a href="https://ricepastem.cafe/">RicePasteM's Cafe</a>
      <nav aria-label="页面操作">
        <a href="https://ricepastem.cafe/resume">[原站]</a>
        <a href="https://github.com/RicePasteM/resume">[GitHub]</a>
        <select :value="locale" aria-label="Language" @change="setLocale($event.target.value)">
          <option v-for="item in locales" :key="item.code" :value="item.code">{{ t(item.labelKey) }}</option>
        </select>
        <button type="button" :aria-pressed="isDark" aria-label="切换深色模式" @click="toggleDarkMode">[{{ isDark ? 'light' : 'dark' }}]</button>
      </nav>
    </header>
    <main><NuxtPage /></main>
    <footer>© {{ new Date().getFullYear() }} RicePasteM's Cafe · <a href="https://ricepastem.cafe/resume">Original resume</a></footer>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
const { locale, locales, t, setLocale, initLocale } = useI18n()
const { isDark, toggleDarkMode, initDarkMode } = useDarkMode()
onMounted(() => { initLocale(); initDarkMode() })
</script>

<style>
.site-header { min-height: 70px; padding: 12px 24px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--color-border); font-family: ui-monospace, monospace; }
.site-header a { color: var(--color-text-primary); text-decoration: none; }
.site-header nav { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.site-header button, .site-header select { font: inherit; color: var(--color-text-primary); background: transparent; border: 0; padding: 6px 0; cursor: pointer; }
footer { padding: 28px 16px; text-align: center; border-top: 1px solid var(--color-border); color: var(--color-text-secondary); font: 12px/1.8 ui-monospace, monospace; }
footer a { color: inherit; }
</style>
