import { nextTick } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  const { initLocale } = useI18n()
  // app:mounted can precede an async page's hydration. Wait for every page
  // boundary so v-html is hydrated in the server locale before switching.
  nuxtApp.hook('app:suspense:resolve', () => nextTick(initLocale))
})
