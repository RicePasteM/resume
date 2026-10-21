export function scrollToResumeSection(element, { offset = 92, behavior = 'smooth' } = {}) {
  const doc = element.ownerDocument
  const container = element.closest('[data-overlayscrollbars-viewport], .os-viewport')
    || doc.scrollingElement || doc.documentElement

  // The document's rectangle moves with scrolling; its viewport origin stays at zero.
  const isDocument = container === doc.scrollingElement || container === doc.documentElement
  const viewportTop = isDocument ? 0 : container.getBoundingClientRect().top + container.clientTop
  const top = container.scrollTop + element.getBoundingClientRect().top - viewportTop - offset

  container.scrollTo({ top: Math.max(top, 0), behavior })
}
