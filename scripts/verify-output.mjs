import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { validateTranslations } from './sync-resume.mjs'
import { collectPdfCodePoints } from '../app/utils/resumePdfCharacters.js'

const output = '.output/public'
const base = process.env.NUXT_APP_BASE_URL || '/resume/'
const html = await readFile(join(output, 'index.html'), 'utf8')
const snapshot = await readFile('app/data/resume.json', 'utf8')
const resume = JSON.parse(snapshot)
validateTranslations(resume, JSON.parse(await readFile('app/i18n/resume-content.json', 'utf8')))
const meta = JSON.parse(await readFile(join(output, 'sync.json'), 'utf8'))
assert.equal(meta.sha256, createHash('sha256').update(snapshot).digest('hex'))
assert.ok(html.includes(resume.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')), 'Profile must appear in server-rendered HTML')
assert.ok(html.includes(`href="${base}"`), 'HTML base must match the Pages path')
assert.ok(html.includes('<title>胡张驰（Zhangchi Hu）</title>'), 'The title must use the requested name')
assert.ok(!html.includes("RicePasteM's Cafe"), 'The independent resume must not contain Cafe branding')
const assets = [...html.matchAll(/(?:src|href)="([^"?#]+\/_nuxt\/[^"?#]+)"/g)].map(match => match[1])
assert.ok(assets.length, 'No generated Nuxt assets found')
for (const url of assets) {
  assert.ok(url.startsWith(base), `Asset escapes the Pages path: ${url}`)
  assert.ok((await stat(join(output, url.slice(base.length)))).isFile(), `Missing asset: ${url}`)
}
for (const font of ['songti-sc-regular', 'songti-sc-bold']) {
  const folder = join(output, 'fonts/chunks', font)
  const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'))
  for (const chunk of manifest.chunks) assert.equal((await stat(join(folder, chunk.file))).size, chunk.size)
}
const compact = JSON.parse(await readFile(join(output, 'fonts/resume/manifest.json'), 'utf8'))
const coverage = new Set(compact.codePoints)
assert.ok(collectPdfCodePoints(resume).every(point => coverage.has(point)), 'Compact PDF fonts must cover the complete resume')
for (const font of Object.values(compact.fonts)) {
  assert.equal((await stat(join(output, 'fonts/resume', font.file))).size, font.size)
}
console.log(`Verified prerendered profile, ${assets.length} asset references, sync hash and compact PDF fonts at ${base}`)
