import test from 'node:test'
import assert from 'node:assert/strict'
import { collectPdfCodePoints } from '../app/utils/resumePdfCharacters.js'
import { createPdfFontLoader } from '../app/utils/resumePdfFontLoader.js'

const files = Object.fromEntries(['normal', 'bold'].map(style => [style, {
  fileName: `${style}.ttf`, chunkManifest: `http://localhost/full/${style}/manifest.json`
}]))
const compactManifest = 'http://localhost/compact/manifest.json'
const manifest = {
  version: 1, codePoints: collectPdfCodePoints('中文日本語'),
  fonts: Object.fromEntries(['normal', 'bold'].map(style => [style, { file: `${style}.ttf`, size: 3 }]))
}

test('PDF glyph collection covers every language, authors, UI labels, layout punctuation and ASCII', () => {
  const points = collectPdfCodePoints({ name: '胡', sections: [{ authors: [{ name: '張' }] }] }, { ja: '語', en: 'CVPR' })
  for (const character of '胡張語CVPR0/@•†—') assert.ok(points.includes(character.codePointAt(0)))
  assert.equal(new Set(points).size, points.length)
  assert.ok(!points.includes(10))
})

test('compact font requests run in parallel and repeated exports reuse font bytes', async () => {
  const requests = []
  const waiting = []
  const load = createPdfFontLoader({ compactManifest, files }, async url => {
    requests.push(url)
    if (url === compactManifest) return Response.json(manifest)
    await new Promise(resolve => {
      waiting.push(resolve)
      if (waiting.length === 2) waiting.forEach(finish => finish())
    })
    return new Response('abc')
  })
  globalThis.window = { location: { href: 'http://localhost/resume/' } }
  try {
    const [first, second] = await Promise.all([load('中文'), load('日本語')])
    assert.deepEqual(first, second)
    assert.deepEqual(first.map(font => font.data), ['YWJj', 'YWJj'])
    await load('English')
    assert.equal(requests.length, 3, 'one manifest and two font requests for all exports')
  } finally { delete globalThis.window }
})

test('fresh characters use full fonts; a failed request can be retried', async () => {
  let fail = true
  let requests = 0
  const load = createPdfFontLoader({ compactManifest, files }, async url => {
    if (url === compactManifest) return Response.json(manifest)
    if (String(url).endsWith('manifest.json')) return Response.json({ size: 3, chunks: [{ file: 'part-000.bin', size: 3 }] })
    requests++
    if (fail) return new Response('unavailable', { status: 503 })
    return new Response('abc')
  })
  globalThis.window = { location: { href: 'http://localhost/resume/' } }
  try {
    await assert.rejects(load('新增'), /Font load failed/)
    fail = false
    const fonts = await load('新增')
    assert.deepEqual(fonts.map(font => font.data), ['YWJj', 'YWJj'])
    const previous = requests
    await load('新增')
    assert.equal(requests, previous)
  } finally { delete globalThis.window }
})

test('an incomplete compact file falls back to full font chunks', async () => {
  const load = createPdfFontLoader({ compactManifest, files }, async url => {
    if (url === compactManifest) return Response.json(manifest)
    if (String(url).includes('/compact/')) return new Response('bad size')
    if (String(url).endsWith('manifest.json')) return Response.json({ size: 3, chunks: [{ file: 'part-000.bin', size: 3 }] })
    return new Response('abc')
  })
  globalThis.window = { location: { href: 'http://localhost/resume/' } }
  try { assert.deepEqual((await load('中文')).map(font => font.data), ['YWJj', 'YWJj']) }
  finally { delete globalThis.window }
})
