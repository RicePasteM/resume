const profileFields = ['headline', 'summary', 'location']
const itemFields = ['title', 'subtitle', 'organization', 'location', 'start_date', 'end_date', 'meta', 'description', 'link_label']

// Translate content fields only. IDs, author identities, links and publication flags
// remain identical across languages so filtering, anchors and PDF authorship agree.
function mapResume(resume, translate) {
  const fields = (record, keys) => Object.fromEntries(keys.filter(key => typeof record[key] === 'string').map(key => [key, translate(record[key])]))
  return {
    ...resume,
    ...fields(resume, profileFields),
    sections: (resume.sections || []).map(section => ({
      ...section,
      title: translate(section.title || ''),
      items: (section.items || []).map(item => ({
        ...item,
        ...fields(item, itemFields),
        points: (item.points || []).map(point => ({ ...point, content: translate(point.content || '') })),
        links: (item.links || []).map(link => ({ ...link, label: translate(link.label || '') }))
      }))
    }))
  }
}

export function collectResumeStrings(resume) {
  const strings = new Set()
  mapResume(resume, value => {
    if (/[\u3400-\u9fff]/.test(value)) strings.add(value)
    return value
  })
  return [...strings]
}

export function localizeResume(resume, locale, translations) {
  if (locale === 'zh-CN') return resume
  const dictionary = translations?.locales?.[locale] || {}
  return mapResume(resume, value => dictionary[value] || value)
}
