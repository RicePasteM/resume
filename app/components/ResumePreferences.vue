<template>
  <div class="resume-preferences">
    <label>
      <svg class="preference-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="m5 8 6 6m-7 0 6-6M2 5h12M7 2h1m14 20-5-10-5 10m2-4h6" />
      </svg>
      <select :value="locale" :aria-label="t('resume.language')" @change="setLocale($event.target.value)">
        <option v-for="item in locales" :key="item.code" :value="item.code">{{ t(item.labelKey) }}</option>
      </select>
    </label>
    <button type="button" :aria-pressed="isDark" :aria-label="t('resume.toggleTheme')" @click="toggleDarkMode">
      <svg class="preference-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <template v-if="isDark">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42M6.35 17.65l-1.42 1.42" />
        </template>
        <path v-else d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      </svg>
      <span>[{{ isDark ? 'light' : 'dark' }}]</span>
    </button>
    <a class="personal-site-link" href="https://ricepastem.cafe/" target="_blank" rel="noopener noreferrer">[{{ t('resume.personalSite') }}]</a>
  </div>
</template>

<script setup>
const { locale, locales, t, setLocale } = useI18n()
const { isDark, toggleDarkMode } = useDarkMode()
</script>

<style scoped>
.resume-preferences { display: grid; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border); font-size: 14px; }
label { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 4px 8px; color: var(--color-text-secondary); }
select, button { color: var(--color-text-secondary); background: transparent; border: 0; font: inherit; cursor: pointer; }
select { min-width: 0; max-width: 100%; }
button { display: flex; align-items: center; gap: 8px; text-align: left; padding: 8px; }
.preference-icon { width: 18px; height: 18px; flex: none; }
button:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
.personal-site-link { display: block; padding: 8px; color: var(--color-text-secondary); text-decoration: none; }
.personal-site-link:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
</style>
