import { ref } from 'vue'
import zhCN from '~/i18n/locales/zh-CN.json'
import zhTW from '~/i18n/locales/zh-TW.json'
import en from '~/i18n/locales/en.json'
import ja from '~/i18n/locales/ja.json'

const LOCALE_STORAGE_KEY = 'codesocean-locale'

export const supportedLocales = [
  { code: 'zh-CN', labelKey: 'locale.zhCN', htmlLang: 'zh-CN' },
  { code: 'zh-TW', labelKey: 'locale.zhTW', htmlLang: 'zh-TW' },
  { code: 'en', labelKey: 'locale.en', htmlLang: 'en' },
  { code: 'ja', labelKey: 'locale.ja', htmlLang: 'ja' }
]

const messages = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja
}

const locale = ref('zh-CN')
const initialized = ref(false)

function normalizeLocale(value) {
  if (!value) return 'zh-CN'
  const normalized = String(value).replace('_', '-')
  if (messages[normalized]) return normalized

  const lower = normalized.toLowerCase()
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.includes('hant')) {
    return 'zh-TW'
  }
  if (lower.startsWith('zh')) return 'zh-CN'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('en')) return 'en'
  return 'zh-CN'
}

function getMessage(key, localeCode = locale.value) {
  const parts = key.split('.')
  let cursor = messages[localeCode]

  for (const part of parts) {
    cursor = cursor?.[part]
    if (cursor == null) break
  }

  if (cursor == null && localeCode !== 'zh-CN') {
    return getMessage(key, 'zh-CN')
  }

  return typeof cursor === 'string' ? cursor : key
}

function interpolate(value, params) {
  if (!params) return value
  return value.replace(/\{(\w+)\}/g, (_, name) => {
    return params[name] == null ? `{${name}}` : String(params[name])
  })
}

export function useI18n() {
  const t = (key, params) => interpolate(getMessage(key), params)

  const setLocale = (nextLocale) => {
    locale.value = normalizeLocale(nextLocale)
    if (process.client) {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale.value)
      document.documentElement.lang = supportedLocales.find(item => item.code === locale.value)?.htmlLang || locale.value
    }
  }

  const initLocale = () => {
    if (!process.client || initialized.value) return
    initialized.value = true

    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
    const browserLocale = navigator.languages?.[0] || navigator.language
    setLocale(storedLocale || normalizeLocale(browserLocale))
  }

  return {
    locale,
    locales: supportedLocales,
    t,
    setLocale,
    initLocale
  }
}
