<template>
  <div class="resume-preferences">
    <label>
      <span>{{ t('resume.language') }}</span>
      <select :value="locale" :aria-label="t('resume.language')" @change="setLocale($event.target.value)">
        <option v-for="item in locales" :key="item.code" :value="item.code">{{ t(item.labelKey) }}</option>
      </select>
    </label>
    <button type="button" :aria-pressed="isDark" :aria-label="t('resume.toggleTheme')" @click="toggleDarkMode">[{{ isDark ? 'light' : 'dark' }}]</button>
  </div>
</template>

<script setup>
const { locale, locales, t, setLocale } = useI18n()
const { isDark, toggleDarkMode } = useDarkMode()
</script>

<style scoped>
.resume-preferences { display: grid; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border); font-size: 14px; }
label { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 4px 8px; }
select, button { color: var(--color-text-secondary); background: transparent; border: 0; font: inherit; cursor: pointer; }
select { min-width: 0; max-width: 100%; }
button { text-align: left; padding: 8px; }
button:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
</style>
