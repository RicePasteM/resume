import { themeBootstrap } from './app/utils/themeBootstrap.js'

const baseURL = process.env.NUXT_APP_BASE_URL || '/resume/'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  // Embed the snapshot in HTML, matching Cafe and avoiding a separate payload request.
  experimental: { payloadExtraction: false },
  css: ['~/assets/css/global.css', '~/assets/css/dark-theme.css'],
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      base: { href: baseURL },
      script: [{ key: 'theme-bootstrap', innerHTML: themeBootstrap, tagPriority: -15 }],
      link: [{ rel: 'canonical', href: 'https://ricepastem.cafe/resume' }]
    }
  },
  nitro: {
    preset: 'static',
    prerender: { routes: ['/'], crawlLinks: false, failOnError: true }
  }
})
