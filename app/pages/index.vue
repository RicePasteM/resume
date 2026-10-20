<template>
  <div class="resume-page">
    <div class="resume-shell">
      <aside class="resume-outline" aria-label="Resume outline">
        <div class="outline-brand">
          <span class="ascii-mark">[resume]</span>
          <strong>{{ resume.name }}</strong>
        </div>
        <nav class="outline-nav">
          <button
            v-for="section in visibleSections"
            :key="sectionKey(section)"
            type="button"
            class="outline-link"
            :class="{ active: activeSectionId === sectionKey(section) }"
            @click="scrollToSection(section)"
          >
            <span>{{ activeSectionId === sectionKey(section) ? '[-]' : '[+]' }}</span>
            {{ displaySectionTitle(section) }}
          </button>
        </nav>
        <div class="outline-actions">
          <button
            type="button"
            class="outline-action"
            :disabled="isGeneratingPdf"
            :aria-busy="isGeneratingPdf"
            @click="getPdf"
          >
            [{{ isGeneratingPdf ? t('resume.generatingPdf') : t('resume.getPdf') }}]
          </button>
        </div>
      </aside>

      <main class="resume-content">
        <section class="resume-hero">
          <div class="hero-terminal">
            <ResumeTerminal class="ascii-title" :initial-text="asciiTitle" />
            <div class="command-row">
              <span class="prompt">|</span>
              <span>profile</span>
              <strong>{{ resume.name }}</strong>
              <span v-if="resume.headline">{{ resume.headline }}</span>
            </div>
            <p v-if="resume.summary" class="hero-summary">{{ resume.summary }}</p>
            <div class="contact-grid">
              <a
                v-for="contact in contactParts"
                :key="contact.text"
                :href="contact.href || undefined"
                :target="contact.href ? '_blank' : undefined"
                :rel="contact.href ? 'noopener noreferrer' : undefined"
                class="contact-row"
              >
                <span>[x]</span>
                {{ contact.text }}
              </a>
            </div>
          </div>
        </section>

        <section
          v-for="section in visibleSections"
          :key="sectionKey(section)"
          :id="sectionKey(section)"
          :ref="el => setSectionRef(section, el)"
          class="resume-section"
        >
          <div class="section-label">
            <span>[+]</span>
            <h2 v-html="renderMarkdown(displaySectionTitle(section))"></h2>
            <div v-if="isPublicationSection(section)" class="publication-actions">
              <button
                type="button"
                class="publication-filter"
                :aria-pressed="publicationPoints.allExpanded(section)"
                :disabled="!publicationPoints.hasExpandableItems(section)"
                @click="publicationPoints.toggleAll(section)"
              >
                <span aria-hidden="true">{{ publicationPoints.allExpanded(section) ? '[x]' : '[ ]' }}</span>
                {{ t('resume.expandPublicationPoints') }}
              </button>
              <button
                type="button"
                class="publication-filter"
                :aria-pressed="showAllPublications"
                @click="showAllPublications = !showAllPublications"
              >
                <span aria-hidden="true">{{ showAllPublications ? '[x]' : '[ ]' }}</span>
                {{ t('resume.viewAllPublications', { count: publicationCount(section) }) }}
              </button>
            </div>
          </div>
          <div class="section-content" :class="`layout-${section.layout_type || 'timeline'}`">
            <article v-for="item in visibleItems(section)" :key="item.id || item.title" class="resume-item" :class="{ 'publication-item-with-points': isPublicationSection(section) && publicationPoints.hasPoints(item) }">
              <div class="item-header">
                <div class="item-title-group">
                  <h3 v-if="isPublicationSection(section) && publicationPoints.hasPoints(item)">
                    <button type="button" class="publication-title-toggle" :aria-expanded="publicationPoints.isExpanded(section, item)" :aria-controls="publicationPoints.pointsId(section, item)" @click="publicationPoints.toggle(section, item)">
                      <span class="publication-point-indicator" aria-hidden="true">{{ publicationPoints.isExpanded(section, item) ? '[-]' : '[+]' }}</span>
                      <span v-html="renderMarkdown(item.title)"></span>
                    </button>
                  </h3>
                  <h3 v-else-if="shouldShowItemTitle(item, section)" v-html="renderMarkdown(item.title)"></h3>
                  <p v-if="item.subtitle" class="item-subtitle" v-html="renderMarkdown(item.subtitle)"></p>
                  <PublicationAuthors v-if="isPublicationSection(section)" :item="item" :profile-name="resume.name" />
                  <p v-if="itemMetaParts(item, section).length > 0" class="item-meta" :class="{ 'publication-tags': isPublicationSection(section) }">
                    <span
                      v-for="(metaPart, metaIndex) in itemMetaParts(item, section)"
                      :key="`${item.id || item.title}-meta-${metaIndex}`"
                      v-html="renderMarkdown(metaPart)"
                    ></span>
                  </p>
                </div>
                <div class="item-side">
                  <span v-if="formatPeriod(item)" v-html="renderMarkdown(formatPeriod(item))"></span>
                  <span v-if="item.location" v-html="renderMarkdown(item.location)"></span>
                </div>
              </div>

              <p v-if="item.description" class="item-description" v-html="renderMarkdown(item.description)"></p>
              <div v-if="itemLinks(item).length > 0" class="item-links">
                <a
                  v-for="link in itemLinks(item)"
                  :key="link.id || link.url"
                  class="item-link"
                  :href="normalizedUrl(link.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span v-html="renderMarkdown(link.label || link.url)"></span>
                </a>
              </div>
              <ul v-if="item.points && item.points.length > 0" v-show="!isPublicationSection(section) || publicationPoints.isExpanded(section, item)" :id="isPublicationSection(section) ? publicationPoints.pointsId(section, item) : undefined" class="item-points">
                <li v-for="point in sortedPoints(item.points)" :key="point.id || point.content">
                  <span>[+]</span>
                  <span v-html="renderMarkdown(point.content)"></span>
                </li>
              </ul>
            </article>
            <p v-if="isPublicationSection(section) && visibleItems(section).length === 0" class="publication-empty" role="status">{{ t('resume.noMatchingPublications') }}</p>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import resumeService from '~/services/resumeService.js'
import { renderResumeMarkdown } from '~/utils/resumeMarkdown.js'
import ResumeTerminal from '~/components/ResumeTerminal.vue'
import PublicationAuthors from '~/components/PublicationAuthors.vue'
import { isPublicationSection, filterResumeItems, publicationTags } from '~/utils/resumePublications.js'
import { usePublicationPoints } from '~/composables/usePublicationPoints.js'

const { t } = useI18n()

useHead(() => ({
  title: t('resume.title'),
  meta: [
    { name: 'description', content: t('resume.description') }
  ]
}))

const fallbackResume = {
  id: 'fallback',
  name: t('resume.name'),
  headline: t('resume.role'),
  summary: t('resume.summary'),
  phone: '',
  email: 'HuZhangchi@hotmail.com',
  website: 'ricepastem.cafe',
  github: 'github.com/RicePasteM',
  location: t('resume.locationValue'),
  sections: [
    {
      id: 'fallback-experience',
      title: t('resume.experience'),
      layout_type: 'timeline',
      sort_order: 10,
      is_visible: true,
      items: [
        {
          id: 'fallback-product',
          title: t('resume.experienceProductTitle'),
          start_date: t('resume.experienceProductPeriod'),
          description: t('resume.experienceProductDesc'),
          sort_order: 10,
          is_visible: true,
          points: []
        },
        {
          id: 'fallback-independent',
          title: t('resume.experienceIndependentTitle'),
          start_date: t('resume.experienceIndependentPeriod'),
          description: t('resume.experienceIndependentDesc'),
          sort_order: 20,
          is_visible: true,
          points: []
        }
      ]
    },
    {
      id: 'fallback-skills',
      title: t('resume.skills'),
      layout_type: 'skills',
      sort_order: 20,
      is_visible: true,
      items: [
        {
          id: 'fallback-skills-item',
          title: 'JavaScript / TypeScript / Vue / Nuxt / Node.js / AI Product / UI Design',
          sort_order: 10,
          is_visible: true,
          points: []
        }
      ]
    }
  ]
}

const { data: resumeData } = await useAsyncData('active-resume', async () => {
  try {
    const response = await resumeService.getActiveResume()
    if (response && response.code === 200 && response.data) {
      return response.data
    }
  } catch (error) {
    console.error('获取简历数据失败:', error)
  }
  return null
})

const sortByOrder = (a, b) => {
  return (a.sort_order || 0) - (b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || ''))
}

const asciiTitle = String.raw` ____  _____ ____  _   _ __  __ _____
|  _ \| ____/ ___|| | | |  \/  | ____|
| |_) |  _| \___ \| | | | |\/| |  _|
|  _ <| |___ ___) | |_| | |  | | |___
|_| \_\_____|____/ \___/|_|  |_|_____|`

const resume = computed(() => {
  if (!resumeData.value || !Array.isArray(resumeData.value.sections) || resumeData.value.sections.length === 0) {
    return fallbackResume
  }
  return resumeData.value
})

const visibleSections = computed(() => {
  return [...(resume.value.sections || [])].filter(section => section.is_visible !== false).sort(sortByOrder)
})

const activeSectionId = ref('')
const isGeneratingPdf = ref(false)
const showAllPublications = ref(false)
const publicationPoints = usePublicationPoints()
const sectionElements = new Map()
let observer = null
let suppressObserverUntil = 0

const contactParts = computed(() => {
  const contacts = []
  if (resume.value.phone) contacts.push({ text: `微信：${resume.value.phone}` })
  if (resume.value.email) contacts.push({ text: resume.value.email, href: `mailto:${resume.value.email}` })
  if (resume.value.website) contacts.push({ text: resume.value.website, href: normalizedUrl(resume.value.website) })
  if (resume.value.github) contacts.push({ text: resume.value.github, href: normalizedUrl(resume.value.github) })
  if (resume.value.location) contacts.push({ text: resume.value.location })
  return contacts
})

const visibleItems = (section) => {
  return filterResumeItems(section, !showAllPublications.value)
}

const publicationCount = (section) => filterResumeItems(section).length

const displaySectionTitle = (section) => {
  if (!isPublicationSection(section)) return section.title
  return t(showAllPublications.value ? 'resume.allPublications' : 'resume.featuredPublications')
}

const renderMarkdown = (value) => {
  return renderResumeMarkdown(value)
}

const itemLinks = (item) => {
  const links = [...(item.links || [])]
    .filter(link => link.is_visible !== false && link.url)
    .sort(sortByOrder)

  if (links.length > 0) return links
  if (item.link_url) {
    return [{
      id: `legacy-${item.id || item.title}`,
      label: item.link_label || item.link_url,
      url: item.link_url,
      sort_order: 10,
      is_visible: true
    }]
  }
  return []
}

const sectionKey = (section) => {
  return `resume-section-${section.id || section.title}`
}

const setSectionRef = (section, el) => {
  const key = sectionKey(section)
  if (el) {
    sectionElements.set(key, el)
  } else {
    sectionElements.delete(key)
  }
}

const observeSections = async () => {
  await nextTick()
  if (observer) observer.disconnect()

  if (visibleSections.value.length > 0 && !activeSectionId.value) {
    activeSectionId.value = sectionKey(visibleSections.value[0])
  }

  if (!process.client) return

  observer = new IntersectionObserver((entries) => {
    if (Date.now() < suppressObserverUntil) return

    const visibleEntry = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0]

    if (visibleEntry) {
      activeSectionId.value = visibleEntry.target.id
    }
  }, {
    rootMargin: '-25% 0px -60% 0px',
    threshold: [0, 0.1, 0.5]
  })

  visibleSections.value.forEach(section => {
    const element = sectionElements.get(sectionKey(section))
    if (element) observer.observe(element)
  })
}

const scrollToSection = (section) => {
  const element = sectionElements.get(sectionKey(section))
  if (!element) return

  const scrollContainer = document.querySelector('[data-overlayscrollbars-viewport]') || document.querySelector('.os-viewport') || document.scrollingElement || document.documentElement
  const containerRect = scrollContainer.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const nextTop = scrollContainer.scrollTop + elementRect.top - containerRect.top - 92

  activeSectionId.value = sectionKey(section)
  suppressObserverUntil = Date.now() + 1200
  scrollContainer.scrollTo({
    top: Math.max(nextTop, 0),
    behavior: 'smooth',
  })
}

const sortedPoints = (points) => {
  return [...(points || [])].sort(sortByOrder)
}

const formatPeriod = (item) => {
  if (item.start_date && item.end_date) return `${item.start_date} - ${item.end_date}`
  return item.start_date || item.end_date || ''
}

const itemMetaParts = (item, section) => {
  if (isPublicationSection(section)) return publicationTags(item, resume.value.name)
  return [
    item.organization,
    item.meta
  ].filter(Boolean)
}

const normalizeTitle = (value) => {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

const shouldShowItemTitle = (item, section) => {
  return normalizeTitle(item.title) !== normalizeTitle(section.title)
}

const normalizedUrl = (url) => {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

const getPdf = async () => {
  if (!process.client || isGeneratingPdf.value) return

  isGeneratingPdf.value = true
  try {
    const { generateResumePdf } = await import('~/utils/resumePdf.client.js')
    await generateResumePdf({
      ...resume.value,
      sections: resume.value.sections.map(section => ({
        ...section,
        title: displaySectionTitle(section),
        items: visibleItems(section)
      }))
    })
  } catch (error) {
    console.error('生成 PDF 失败:', error)
    window.alert(t('resume.generatePdfFailed'))
  } finally {
    isGeneratingPdf.value = false
  }
}

onMounted(() => {
  observeSections()
})

watch(visibleSections, () => {
  observeSections()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<style scoped>
.resume-page {
  min-height: 100vh;
  padding: 48px 24px 64px;
  color: #111111;
  background: #fafafa;
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.resume-page :deep(*) {
  font-family: inherit;
}

.resume-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}

.resume-outline {
  position: sticky;
  top: 48px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  color: #333333;
}

.outline-brand {
  padding: 16px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  display: grid;
  gap: 4px;
  color: #111111;
}

.ascii-mark {
  color: #666666;
  font-size: 14px;
  line-height: 2;
}

.outline-nav {
  display: grid;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.outline-link,
.outline-action {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: var(--mono-radius);
  padding: 4px 8px;
  color: #666666;
  background: transparent;
  text-align: left;
  text-decoration: none;
  font-size: 16px;
  line-height: 1.5;
  cursor: pointer;
}

.outline-link.active,
.outline-link:hover,
.outline-action:hover {
  color: #111111;
  background: #f5f5f5;
}

.outline-actions {
  display: grid;
  gap: 4px;
  padding-top: 12px;
}

.outline-action {
  width: 100%;
  box-sizing: border-box;
}

.resume-content {
  min-width: 0;
}

.resume-content :deep(u) {
  text-underline-offset: 3px;
}

.resume-content :deep(strong) {
  font-weight: 700;
}

.resume-content :deep(em) {
  font-style: italic;
}

.resume-hero {
  margin-bottom: 96px;
}

.hero-terminal {
  padding: 40px 32px;
  color: #fafafa;
  background: #111111;
}

.ascii-title {
  margin: 0 0 32px;
  overflow: hidden;
  color: #fafafa;
  font-size: 14px;
  line-height: 1.15;
}

.command-row {
  min-height: 40px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  border-radius: var(--mono-radius);
  padding: 8px 12px;
  color: #fafafa;
  background: #1a1a1a;
}

.command-row strong {
  font-weight: 700;
}

.prompt {
  color: #999999;
}

.hero-summary {
  margin: 24px 0 0;
  max-width: 760px;
  color: #cccccc;
  font-size: 16px;
  line-height: 1.5;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
  margin-top: 24px;
}

.contact-row {
  display: inline-flex;
  gap: 8px;
  color: #fafafa;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.contact-row:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.resume-section {
  scroll-margin-top: 92px;
  margin-bottom: 96px;
}

.section-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.section-label span {
  color: #666666;
}

.section-label h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
  letter-spacing: 0;
}

.publication-actions { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-left: auto; }
.publication-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.publication-filter:hover { opacity: 0.7; }
.publication-filter:disabled { opacity: 0.4; cursor: default; }
.publication-filter:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.publication-title-toggle { display: flex; align-items: baseline; gap: 8px; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.publication-title-toggle:hover { opacity: 0.8; }
.publication-title-toggle:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.publication-point-indicator { width: 3ch; flex-shrink: 0; color: #666666; font-weight: 400; }
.publication-filter span { color: inherit; white-space: nowrap; }
.publication-empty { margin: 20px 0; color: #777; font-size: 14px; }

.item-meta.publication-tags { gap: 6px; margin-top: 6px; }
.publication-tags > span { border: 1px solid rgba(128, 128, 128, 0.35); padding: 1px 6px; border-radius: var(--mono-radius); font-size: 12px; }
.item-meta.publication-tags > span:not(:last-child)::after { content: none; }

.resume-item {
  padding: 16px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  color: #333333;
  font-size: 16px;
  line-height: 1.5;
}

.resume-item:last-child {
  border-bottom: 0;
}

.publication-item-with-points {
  --publication-point-gutter: calc(3ch + 8px);
  padding-left: var(--publication-point-gutter);
}

.publication-item-with-points .publication-title-toggle {
  width: calc(100% + var(--publication-point-gutter));
  margin-left: calc(-1 * var(--publication-point-gutter));
}

.layout-skills .resume-item {
  padding: 8px 0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
}

.item-title-group {
  min-width: 0;
}

.item-title-group h3 {
  margin: 0;
  color: #111111;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
}

.item-subtitle {
  margin: 2px 0 0;
  color: #333333;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin: 4px 0 0;
  color: #666666;
  font-size: 15px;
}

.item-meta span:not(:last-child)::after {
  content: '|';
  margin-left: 0.75rem;
  color: #999999;
}

.item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  color: #666666;
  white-space: nowrap;
}

.item-description {
  margin: 8px 0 0;
  color: #333333;
}

.item-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
}

.item-link {
  display: inline-block;
  color: #111111;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.item-points {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.item-points li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
}

@media (max-width: 900px) {
  .resume-shell {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .resume-outline {
    position: static;
  }

  .outline-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }

  .contact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .resume-page {
    padding: 32px 16px 48px;
  }

  .hero-terminal {
    padding: 32px 20px;
  }

  .ascii-title {
    font-size: 10px;
  }

  .outline-nav {
    grid-template-columns: 1fr;
  }

  .resume-hero,
  .resume-section {
    margin-bottom: 64px;
  }

  .item-header {
    flex-direction: column;
    gap: 4px;
  }

  .item-side {
    align-items: flex-start;
  }

  .item-meta {
    font-size: 14px;
  }
}
</style>

<style>
html.dark .resume-page {
  color: #fafafa;
  background: #111111;
}

html.dark .resume-outline {
  color: #cccccc;
  border-top-color: rgba(250, 250, 250, 0.12);
}

html.dark .outline-brand {
  color: #fafafa;
  border-bottom-color: rgba(250, 250, 250, 0.12);
}

html.dark .ascii-mark,
html.dark .section-label span,
html.dark .outline-link,
html.dark .outline-action,
html.dark .item-meta,
html.dark .resume-page .publication-authors,
html.dark .publication-point-indicator,
html.dark .item-side,
html.dark .item-points li > span:first-child {
  color: #999999;
}

html.dark .outline-nav {
  border-bottom-color: rgba(250, 250, 250, 0.12);
}

html.dark .outline-link.active,
html.dark .outline-link:hover,
html.dark .outline-action:hover {
  color: #fafafa;
  background: #1a1a1a;
}

html.dark .hero-terminal {
  color: #fafafa;
  background: #000000;
  border: 1px solid rgba(250, 250, 250, 0.12);
}

html.dark .ascii-title,
html.dark .command-row,
html.dark .contact-row {
  color: #fafafa;
}

html.dark .command-row {
  background: #1a1a1a;
}

html.dark .prompt,
html.dark .hero-summary {
  color: #999999;
}

html.dark .section-label,
html.dark .resume-item {
  border-bottom-color: rgba(250, 250, 250, 0.12);
}

html.dark .section-label h2,
html.dark .item-title-group h3,
html.dark .item-link {
  color: #fafafa;
}

html.dark .resume-item,
html.dark .item-subtitle,
html.dark .item-description,
html.dark .item-points {
  color: #cccccc;
}

html.dark .item-meta span:not(:last-child)::after {
  color: #666666;
}
</style>
