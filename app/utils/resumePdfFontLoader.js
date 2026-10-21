import { collectPdfCodePoints } from './resumePdfCharacters.js'

const toBase64 = buffer => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function createPdfFontLoader({ compactManifest, files }, get = (...args) => fetch(...args)) {
  const cache = new Map()
  const cached = (key, load) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(load).catch(error => {
      cache.delete(key) // A transient failure must not poison later exports.
      throw error
    }))
    return cache.get(key)
  }
  const response = async url => {
    const result = await get(url)
    if (!result.ok) throw new Error(`Font load failed: ${url} ${result.status}`)
    return result
  }
  const buffer = async (url, size) => {
    const bytes = await (await response(url)).arrayBuffer()
    if (size && bytes.byteLength !== size) throw new Error(`Font size mismatch: ${url}`)
    return bytes
  }
  const fullFont = async font => {
    const manifest = await (await response(font.chunkManifest)).json()
    const base = new URL('.', new URL(font.chunkManifest, window.location.href))
    const chunks = await Promise.all(manifest.chunks.map(chunk => buffer(new URL(chunk.file, base).href, chunk.size)))
    const length = chunks.reduce((size, chunk) => size + chunk.byteLength, 0)
    if (length !== manifest.size) throw new Error(`Font size mismatch: ${font.fileName}`)
    const merged = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { merged.set(new Uint8Array(chunk), offset); offset += chunk.byteLength }
    return toBase64(merged)
  }

  return async (...content) => {
    // A fresh API edit can introduce characters after the last build. Use full
    // fonts in that case rather than exporting missing glyphs from an old subset.
    const manifest = await cached(compactManifest, async () => (await response(compactManifest)).json()).catch(() => null)
    const coverage = new Set(manifest?.codePoints || [])
    const compact = manifest?.version === 1 && collectPdfCodePoints(...content).every(point => coverage.has(point))
    return Promise.all(Object.entries(files).map(async ([style, font]) => {
      const subset = compact && manifest.fonts?.[style]
      if (subset) {
        const url = new URL(subset.file, new URL(compactManifest, window.location.href)).href
        try {
          return { style, fileName: font.fileName, data: await cached(url, async () => toBase64(await buffer(url, subset.size))) }
        } catch { /* Use the full font if a deployment temporarily lacks a hashed file. */ }
      }
      return { style, fileName: font.fileName, data: await cached(font.chunkManifest, () => fullFont(font)) }
    }))
  }
}
