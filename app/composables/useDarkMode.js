import { ref, watch } from 'vue'

const STORAGE_KEY = 'codesocean-dark-mode'

const isDark = ref(false)
const isSystemDark = ref(false)

let mediaQuery = null
let initialized = false

function getStoredPreference() {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') return 'dark'
    if (stored === 'light') return 'light'
    return null
  } catch {
    return null
  }
}

function applyTheme(dark) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}

export function useDarkMode() {
  if (typeof window === 'undefined') {
    return {
      isDark: ref(false),
      isSystemDark: ref(false),
      toggleDarkMode: () => {},
      initDarkMode: () => {},
    }
  }

  if (!initialized) {
    initialized = true

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    isSystemDark.value = mediaQuery.matches

    // Keep reactive markup equal to SSR until mounted. The head script already
    // sets the correct root theme; don't overwrite it during hydration.
    watch(isDark, applyTheme)

    mediaQuery.addEventListener('change', (e) => {
      isSystemDark.value = e.matches
      if (getStoredPreference() === null) {
        isDark.value = e.matches
      }
    })
  }

  function toggleDarkMode() {
    isDark.value = !isDark.value
    try {
      localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    } catch {}
  }

  function initDarkMode() {
    const stored = getStoredPreference()
    isDark.value = stored === 'dark' || (stored !== 'light' && isSystemDark.value)
    applyTheme(isDark.value)
  }

  return {
    isDark,
    isSystemDark,
    toggleDarkMode,
    initDarkMode,
  }
}
