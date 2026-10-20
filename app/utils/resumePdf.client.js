import { jsPDF } from 'jspdf'
import { isPublicationSection, publicationAuthorsMarkdown, publicationTags } from './resumePublications.js'

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 28.35,
  top: 38.4,
  bottom: 24
}

const FONT = {
  family: 'SongtiSC',
  files: {
    normal: {
      fileName: 'songti-sc-regular.ttf',
      chunkManifest: 'fonts/chunks/songti-sc-regular/manifest.json'
    },
    bold: {
      fileName: 'songti-sc-bold.ttf',
      chunkManifest: 'fonts/chunks/songti-sc-bold/manifest.json'
    }
  }
}

const COLOR = {
  ink: '#111111',
  muted: '#444444',
  rule: '#111111'
}

const sortByOrder = (a, b) => {
  return (a.sort_order || 0) - (b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || ''))
}

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

const fetchArrayBuffer = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Font load failed: ${url} ${response.status}`)
  }

  return response.arrayBuffer()
}

const loadChunkedFont = async (font) => {
  const manifestResponse = await fetch(font.chunkManifest)
  if (!manifestResponse.ok) {
    throw new Error(`Font manifest load failed: ${font.chunkManifest} ${manifestResponse.status}`)
  }

  const manifest = await manifestResponse.json()
  const baseUrl = new URL('.', new URL(font.chunkManifest, window.location.href))
  const chunks = []
  let totalLength = 0

  for (const chunk of manifest.chunks || []) {
    const buffer = await fetchArrayBuffer(new URL(chunk.file, baseUrl).toString())
    const bytes = new Uint8Array(buffer)

    chunks.push(bytes)
    totalLength += bytes.byteLength
  }

  if (manifest.size && totalLength !== manifest.size) {
    throw new Error(`Font chunk size mismatch: ${font.fileName}`)
  }

  const merged = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return merged.buffer
}

const loadFont = async (doc) => {
  for (const [style, font] of Object.entries(FONT.files)) {
    const fontBase64 = arrayBufferToBase64(await loadChunkedFont(font))
    doc.addFileToVFS(font.fileName, fontBase64)
    doc.addFont(font.fileName, FONT.family, style)
  }
  doc.addFont(FONT.files.normal.fileName, FONT.family, 'italic')
  doc.addFont(FONT.files.bold.fileName, FONT.family, 'bolditalic')
  doc.setFont(FONT.family, 'normal')
}

const normalizeUrl = (url) => {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

const decodeEntities = (value) => {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

const normalizeRichSource = (value) => {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<u>/gi, '++')
    .replace(/<\/u>/gi, '++')
    .replace(/<(strong|b)>/gi, '**')
    .replace(/<\/(strong|b)>/gi, '**')
    .replace(/<(em|i)>/gi, '*')
    .replace(/<\/(em|i)>/gi, '*')
}

const text = (value) => {
  return normalizeRichSource(value)
    .replace(/\+\+([\s\S]+?)\+\+/g, '$1')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/(^|[^\*])\*([^\*\n]+?)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1$2')
    .trim()
}

const markdownToken = (source, index, state) => {
  const two = source.slice(index, index + 2)
  if (two === '**' && (state.bold || source.indexOf('**', index + 2) !== -1)) return { marker: 'bold', length: 2 }
  if (two === '__' && (state.bold || source.indexOf('__', index + 2) !== -1)) return { marker: 'bold', length: 2 }
  if (two === '++' && (state.underline || source.indexOf('++', index + 2) !== -1)) return { marker: 'underline', length: 2 }

  const one = source[index]
  if ((one === '*' || one === '_') && (state.italic || source.indexOf(one, index + 1) !== -1)) {
    return { marker: 'italic', length: 1 }
  }

  return null
}

const parseRichText = (value, defaults = {}) => {
  const source = normalizeRichSource(value)
  const state = {
    bold: Boolean(defaults.bold),
    italic: Boolean(defaults.italic),
    underline: Boolean(defaults.underline)
  }
  const runs = []
  let buffer = ''

  const push = () => {
    if (!buffer) return
    runs.push({
      text: buffer,
      bold: state.bold,
      italic: state.italic,
      underline: state.underline
    })
    buffer = ''
  }

  for (let index = 0; index < source.length;) {
    const token = markdownToken(source, index, state)
    if (token) {
      push()
      state[token.marker] = !state[token.marker]
      index += token.length
      continue
    }

    buffer += source[index]
    index += 1
  }

  push()
  return runs.length > 0 ? runs : [{ text: '', ...state }]
}

const period = (item) => {
  if (item.start_date && item.end_date) return `${text(item.start_date)}—${text(item.end_date)}`
  return text(item.start_date || item.end_date || '')
}

const visibleSections = (resume) => {
  return [...(resume.sections || [])].filter(section => section.is_visible !== false).sort(sortByOrder)
}

const visibleItems = (section) => {
  return [...(section.items || [])].filter(item => item.is_visible !== false).sort(sortByOrder)
}

const visiblePoints = (item) => {
  return [...(item.points || [])].sort(sortByOrder)
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

const tokenize = (value) => {
  return String(value || '').match(/[\u4e00-\u9fff]|[^\s\u4e00-\u9fff]+|\s+/g) || []
}

const shouldAvoidLineStart = (token) => {
  return /^[,，.。;；:：!！?？、…）)\]】}〉》」』”’%％]/.test(String(token || '').trimStart())
}

const setTextStyle = (doc, size, style = 'normal', color = COLOR.ink) => {
  doc.setFont(FONT.family, style)
  doc.setFontSize(size)
  doc.setTextColor(color)
}

const fontStyleForRun = (run) => {
  if (run.bold && run.italic) return 'bolditalic'
  if (run.bold) return 'bold'
  if (run.italic) return 'italic'
  return 'normal'
}

const BODY_SIZE = 10.5
const BODY_LEADING = 15.75
const TITLE_SIZE = 12
const SECTION_SIZE = 14
const BULLET_X = 31.8
const BULLET_TEXT_X = 42
const FAUX_ITALIC_SKEW = 0.22

const lineHeight = (fontSize, ratio = 1.5) => fontSize * ratio

const makeFilename = (resume) => {
  const base = text(resume.name || 'resume')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48)
  return `${base || 'resume'}.pdf`
}

export const generateResumePdf = async (resume, { equalContribution = '† 同等贡献' } = {}) => {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true
  })

  await loadFont(doc)

  let y = PAGE.top
  const contentWidth = PAGE.width - PAGE.marginX * 2
  const rightX = PAGE.width - PAGE.marginX

  const addPage = () => {
    doc.addPage()
    y = PAGE.top
  }

  const ensureSpace = (height) => {
    if (y + height > PAGE.height - PAGE.bottom) addPage()
  }

  const drawRule = (ruleY) => {
    doc.setDrawColor(COLOR.rule)
    doc.setLineWidth(0.45)
    doc.line(PAGE.marginX, ruleY, rightX, ruleY)
  }

  const styledTokens = (runs) => {
    return runs.flatMap(run => tokenize(run.text).map(token => ({
      text: token,
      bold: run.bold,
      italic: run.italic,
      underline: run.underline
    })))
  }

  const setRunStyle = (run, size, color) => {
    setTextStyle(doc, size, fontStyleForRun(run), color)
  }

  const italicMatrix = (baseline) => {
    return new doc.Matrix(1, 0, FAUX_ITALIC_SKEW, 1, -FAUX_ITALIC_SKEW * (PAGE.height - baseline), 0)
  }

  const tokenWidth = (token, size, color) => {
    setRunStyle(token, size, color)
    return doc.getTextWidth(token.text)
  }

  const trimLineEnd = (line) => {
    const nextLine = [...line]
    while (nextLine.length > 0 && !nextLine[nextLine.length - 1].text.trim()) {
      nextLine.pop()
    }
    return nextLine
  }

  const wrapRichText = (value, maxWidth, {
    size = BODY_SIZE,
    color = COLOR.ink,
    style = 'normal'
  } = {}) => {
    const defaults = {
      bold: style === 'bold' || style === 'bolditalic',
      italic: style === 'italic' || style === 'bolditalic'
    }
    const paragraphs = normalizeRichSource(value).split(/\n+/)
    const lines = []

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const runs = parseRichText(paragraph).map(run => ({
        ...run,
        bold: defaults.bold || run.bold,
        italic: defaults.italic || run.italic
      }))
      const tokens = styledTokens(runs)
      let line = []
      let width = 0

      tokens.forEach((rawToken) => {
        const token = {
          ...rawToken,
          text: line.length > 0 ? rawToken.text : rawToken.text.trimStart()
        }
        if (!token.text) return

        const nextWidth = tokenWidth(token, size, color)
        if (width + nextWidth <= maxWidth || line.length === 0) {
          line.push(token)
          width += nextWidth
          return
        }

        if (shouldAvoidLineStart(token.text)) {
          line.push(token)
          width += nextWidth
          return
        }

        lines.push(trimLineEnd(line))
        line = [{ ...token, text: token.text.trimStart() }]
        width = tokenWidth(line[0], size, color)
      })

      const finalLine = trimLineEnd(line)
      if (finalLine.length > 0) lines.push(finalLine)
      if (paragraphIndex < paragraphs.length - 1) lines.push([])
    })

    return lines.length > 0 ? lines : [[]]
  }

  const drawRichLine = (line, x, baseline, {
    size = BODY_SIZE,
    color = COLOR.ink
  } = {}) => {
    let cursorX = x
    line.forEach((run) => {
      if (!run.text) return
      setRunStyle(run, size, color)
      if (run.italic) {
        doc.text(run.text, cursorX, baseline, { angle: italicMatrix(baseline) })
      } else {
        doc.text(run.text, cursorX, baseline)
      }
      const width = doc.getTextWidth(run.text)
      if (run.underline) {
        doc.setDrawColor(color)
        doc.setLineWidth(0.35)
        doc.line(cursorX, baseline + 1.6, cursorX + width, baseline + 1.6)
      }
      cursorX += width
    })
  }

  const drawWrapped = (value, x, maxWidth, {
    size = BODY_SIZE,
    style = 'normal',
    color = COLOR.ink,
    firstLinePrefix = '',
    indent = 0,
    leading = BODY_LEADING
  } = {}) => {
    setTextStyle(doc, size, style, color)
    const prefixWidth = firstLinePrefix ? doc.getTextWidth(firstLinePrefix) : 0
    const lines = wrapRichText(value, maxWidth - indent - prefixWidth, { size, color, style })
    lines.forEach((line, index) => {
      ensureSpace(leading + 3)
      const lineX = index === 0 ? x : x + indent
      if (index === 0 && firstLinePrefix) {
        doc.text(firstLinePrefix, lineX, y)
      }
      drawRichLine(line, lineX + (index === 0 ? prefixWidth : 0), y, { size, color })
      y += leading
    })
  }

  const drawCenteredText = (value, size, style = 'normal') => {
    const content = text(value)
    if (!content) return
    setTextStyle(doc, size, style)
    doc.text(content, PAGE.width / 2, y, { align: 'center' })
    y += lineHeight(size, 1.2)
  }

  const drawContactLine = () => {
    const contacts = [
      resume.phone,
      resume.email,
      resume.website,
      resume.github,
      resume.location
    ]
      .map(value => text(value))
      .filter(Boolean)
      .map((value) => ({
        label: value,
        href: value.includes('@')
          ? `mailto:${value}`
          : (/\.|github/i.test(value) ? normalizeUrl(value) : '')
      }))

    if (contacts.length === 0) return

    setTextStyle(doc, BODY_SIZE)
    const separator = ' | '
    const totalWidth = contacts.reduce((sum, contact, index) => {
      return sum + doc.getTextWidth(contact.label) + (index === contacts.length - 1 ? 0 : doc.getTextWidth(separator))
    }, 0)

    let x = Math.max(PAGE.marginX, (PAGE.width - totalWidth) / 2)
    contacts.forEach((contact, index) => {
      const width = doc.getTextWidth(contact.label)
      doc.text(contact.label, x, y)
      if (contact.href) {
        doc.setLineWidth(0.35)
        doc.line(x, y + 2, x + width, y + 2)
        doc.link(x, y - 10, width, 13, { url: contact.href })
      }
      x += width
      if (index < contacts.length - 1) {
        doc.text(separator, x, y)
        x += doc.getTextWidth(separator)
      }
    })
    y += 18
  }

  const drawLeftLine = (parts, x, maxWidth, options = {}) => {
    const content = parts.filter(value => text(value)).join(options.separator || ' | ')
    if (!content) return

    drawWrapped(content, x, maxWidth, {
      size: options.size || BODY_SIZE,
      color: options.color || COLOR.muted,
      leading: options.leading || BODY_LEADING
    })
  }

  const drawLinks = (links) => {
    const normalizedLinks = links
      .map(link => ({
        label: text(link.label || link.url),
        url: normalizeUrl(link.url)
      }))
      .filter(link => link.label && link.url)

    if (normalizedLinks.length === 0) return

    const size = BODY_SIZE
    setTextStyle(doc, size, 'normal', COLOR.ink)
    const separator = ' | '
    let x = PAGE.marginX + 5.25

    ensureSpace(BODY_LEADING + 4)
    normalizedLinks.forEach((link, index) => {
      const width = doc.getTextWidth(link.label)
      doc.text(link.label, x, y)
      doc.setLineWidth(0.35)
      doc.line(x, y + 2, x + width, y + 2)
      doc.link(x, y - 10, width, 13, { url: link.url })
      x += width
      if (index < normalizedLinks.length - 1) {
        doc.text(separator, x, y)
        x += doc.getTextWidth(separator)
      }
    })
    y += BODY_LEADING
  }

  const drawHeader = () => {
    drawCenteredText(resume.name || 'Resume', 18, 'normal')
    y += 1.6
    drawContactLine()

    if (resume.headline) {
      drawCenteredText(resume.headline, BODY_SIZE)
    }

    if (resume.summary) {
      y += 4.5
      drawWrapped(resume.summary, PAGE.marginX + 5.25, contentWidth - 10.5, {
        size: BODY_SIZE,
        color: COLOR.muted,
        leading: BODY_LEADING
      })
    }

    y += 11.4
  }

  const drawItem = (item, section) => {
    const title = text(item.title)
    const sectionTitle = text(section.title).replace(/\s+/g, ' ')
    const shouldShowTitle = title && title.replace(/\s+/g, ' ') !== sectionTitle
    const sideParts = [period(item), text(item.location)].filter(Boolean)
    const sideText = sideParts.join('  ')
    setTextStyle(doc, TITLE_SIZE)
    const sideWidth = sideText ? doc.getTextWidth(sideText) : 0
    const titleMaxWidth = sideText ? contentWidth - sideWidth - 18 : contentWidth

    if (shouldShowTitle || sideText) {
      ensureSpace(18)
      const titleLines = shouldShowTitle
        ? wrapRichText(item.title, Math.max(180, titleMaxWidth), {
          size: TITLE_SIZE,
          style: 'bold',
          color: COLOR.ink
        })
        : [[]]

      titleLines.forEach((line, index) => {
        ensureSpace(index === 0 ? 15 : 14)
        if (line.length > 0) {
          drawRichLine(line, PAGE.marginX, y, {
            size: TITLE_SIZE,
            color: COLOR.ink
          })
        }
        if (index === 0 && sideText) {
          setTextStyle(doc, TITLE_SIZE, 'normal')
          doc.text(sideText, rightX, y, { align: 'right' })
        }
        y += index === titleLines.length - 1 ? 15 : 14
      })
    }

    if (item.subtitle) {
      drawWrapped(item.subtitle, PAGE.marginX + 5.25, contentWidth - 5.25, {
        size: BODY_SIZE,
        style: isPublicationSection(section) ? 'normal' : 'italic',
        color: COLOR.muted,
        leading: 13.5
      })
    }

    if (isPublicationSection(section)) {
      const authors = publicationAuthorsMarkdown(item, resume.name)
      if (authors) drawWrapped(authors + (item.authors?.some(author => author.is_co_first) ? `  (${equalContribution})` : ''), PAGE.marginX + 5.25, contentWidth - 5.25, {
        size: BODY_SIZE,
        color: COLOR.ink,
        leading: 13.5
      })
    }

    const metaParts = isPublicationSection(section)
      ? publicationTags(item, resume.name)
      : [item.organization, item.meta].filter(value => text(value))
    if (metaParts.length > 0) {
      drawLeftLine(metaParts, PAGE.marginX + 5.25, contentWidth - 5.25, {
        color: COLOR.muted,
        leading: 13.5
      })
    }

    const links = itemLinks(item)
    if (links.length > 0) {
      drawLinks(links)
    }

    if (item.description) {
      drawWrapped(item.description, PAGE.marginX + 5.25, contentWidth - 5.25, {
        size: BODY_SIZE,
        color: COLOR.muted,
        leading: BODY_LEADING
      })
    }

    visiblePoints(item).forEach((point) => {
      drawBullet(point.content)
    })

    y += 2
  }

  const drawBullet = (value) => {
    const content = text(value)
    if (!content) return

    setTextStyle(doc, BODY_SIZE, 'normal')
    const lines = wrapRichText(value, rightX - BULLET_TEXT_X, {
      size: BODY_SIZE,
      color: COLOR.ink
    })
    lines.forEach((line, index) => {
      ensureSpace(BODY_LEADING + 3)
      if (index === 0) {
        doc.text('•', BULLET_X, y)
      }
      drawRichLine(line, BULLET_TEXT_X, y, {
        size: BODY_SIZE,
        color: COLOR.ink
      })
      y += BODY_LEADING
    })
  }

  const drawSkillsSection = (section) => {
    visibleItems(section).forEach((item) => {
      const parts = [
        item.title,
        item.subtitle,
        item.organization,
        item.meta,
        item.description
      ].map(value => text(value)).filter(Boolean)

      const content = parts.join('  ')
      if (content) {
        drawBullet(content)
      }

      visiblePoints(item).forEach((point) => {
        drawBullet(point.content)
      })
    })
  }

  drawHeader()

  visibleSections(resume).forEach((section) => {
    ensureSpace(36)
    setTextStyle(doc, SECTION_SIZE, 'bold')
    doc.text(text(section.title), PAGE.marginX, y)
    drawRule(y + 5)
    y += 21

    if ((section.layout_type || '').toLowerCase() === 'skills') {
      drawSkillsSection(section)
    } else {
      visibleItems(section).forEach(item => drawItem(item, section))
    }

    y += 7
  })

  const pageCount = doc.getNumberOfPages()
  if (pageCount > 1) {
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page)
      setTextStyle(doc, 8.5, 'normal', COLOR.muted)
      doc.text(`${page} / ${pageCount}`, PAGE.width / 2, PAGE.height - 16, { align: 'center' })
    }
  }

  doc.save(makeFilename(resume))
}
