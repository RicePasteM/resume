// Author order is the publication's printed order; a co-first author keeps that
// position while also counting as a first author in authorship labels.
export const isPublicationSection = (section = {}) => {
  return /^(publications?|papers?)$/i.test(section.section_key || '') ||
    section.layout_type === 'publications' || /论文|論文|publications?|papers?/i.test(section.title || '')
}

const normalizeName = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s.,，·-]/g, '')

export const publicationAuthors = (item = {}, profileName = '') => {
  const authors = Array.isArray(item.authors) ? item.authors : []
  const hasExplicitSelf = authors.some(author => author?.is_self === true)
  const ownNames = [profileName, ...String(profileName).split(/[()（）/]/)].map(normalizeName).filter(Boolean)
  return authors.map(author => ({
    name: String(author?.name || '').trim(),
    is_self: author?.is_self === true || (!hasExplicitSelf && ownNames.includes(normalizeName(author?.name))),
    is_co_first: author?.is_co_first === true
  })).filter(author => author.name)
}

export const importPublicationAuthorList = (text, existingAuthors = [], profileName = '') => {
  const names = String(text || '').split(/[,，\r\n]+/).map(name => name.trim()).filter(Boolean)
  if (!names.length) throw new Error('请先粘贴作者名单。')
  if (names.length > 200) throw new Error('作者名单最多支持 200 位作者。')
  if (names.some(name => name.length > 255)) throw new Error('单个作者姓名不能超过 255 个字符，请检查分隔逗号。')
  const existing = new Map(existingAuthors.map(author => [normalizeName(author.name), author]))
  const authors = publicationAuthors({ authors: names.map(name => ({
    name,
    is_self: existing.get(normalizeName(name))?.is_self === true,
    is_co_first: existing.get(normalizeName(name))?.is_co_first === true
  })) }, profileName)
  // Repeated names must not create multiple explicit owners in the API payload.
  let foundSelf = false
  return authors.map(author => {
    const isSelf = author.is_self && !foundSelf
    foundSelf ||= isSelf
    return { ...author, is_self: isSelf }
  })
}

const legacyRole = item => String(item.organization || '').replace(/[*_]/g, '').trim()
const isLegacyAuthorRole = value => /^(?:第[一二三四五六七八九十\d]+作者|非第一作者|共同(?:第一作者|一作)|同等贡献(?:第一作者|排序)?|第一作者(?:[（(].*[）)])?)$/.test(value)

export const publicationAuthorship = (item = {}, profileName = '') => {
  const authors = publicationAuthors(item, profileName)
  if (authors.length) {
    const selfIndex = authors.findIndex(author => author.is_self)
    const coFirst = selfIndex >= 0 && authors[selfIndex].is_co_first
    return { first: selfIndex === 0 || coFirst, coFirst, rank: selfIndex < 0 ? null : selfIndex + 1 }
  }
  // Preserve existing resumes until their structured author lists are filled in.
  const role = legacyRole(item)
  const coFirst = /^(共同(?:第一作者|一作)|同等贡献(?:第一作者|排序)?)$/.test(role)
  return { first: coFirst || /^第一作者(?:[（(].*[）)])?$/.test(role), coFirst, rank: null }
}

export const publicationTags = (item = {}, profileName = '') => {
  const authors = publicationAuthors(item, profileName)
  const role = publicationAuthorship(item, profileName)
  const organization = legacyRole(item)
  const tags = String(item.meta || '').split(/\s*[|｜]\s*/).filter(Boolean)
  if (authors.length && isLegacyAuthorRole(organization)) {
    if (role.first) tags.unshift(role.coFirst ? '共同第一作者' : '第一作者')
    else if (role.rank) tags.unshift(`第 ${role.rank} 作者`)
  } else if (organization) tags.unshift(item.organization)
  return tags
}

const publicationDateValue = value => {
  const match = String(value || '').trim().match(/^(\d{4})(?:[./\-年](\d{1,2}))?(?:[./\-月](\d{1,2}))?[年月日]?$/)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2] || 1), day = Number(match[3] || 1)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return year * 10000 + month * 100 + day
}

const publicationDate = item => publicationDateValue(item.end_date) ?? publicationDateValue(item.start_date) ?? -1

export const filterResumeItems = (section = {}, featuredOnly = false) => {
  const publications = isPublicationSection(section)
  return [...(section.items || [])]
    .filter(item => item.is_visible !== false &&
      (!featuredOnly || !publications || item.is_featured === true))
    .sort((a, b) => (publications ? publicationDate(b) - publicationDate(a) : 0) ||
      (a.sort_order || 0) - (b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || '')))
}

export const publicationAuthorsMarkdown = (item, profileName) => {
  return publicationAuthors(item, profileName).map(author => {
    // Names are plain text in the editor, including in PDF output.
    const name = author.name.replace(/[\\*_`<>]/g, '')
    return `${author.is_self ? `**${name}**` : name}${author.is_co_first ? '†' : ''}`
  }).join(', ')
}
