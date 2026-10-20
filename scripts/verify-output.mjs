import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const output = '.output/public'
const base = process.env.NUXT_APP_BASE_URL || '/resume/'
const html = await readFile(join(output, 'index.html'), 'utf8')
const snapshot = await readFile('app/data/resume.json', 'utf8')
const resume = JSON.parse(snapshot)
const meta = JSON.parse(await readFile(join(output, 'sync.json'), 'utf8'))
assert.equal(meta.sha256, createHash('sha256').update(snapshot).digest('hex'))
assert.ok(html.includes(resume.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')), 'Profile must appear in server-rendered HTML')
assert.ok(html.includes(`href="${base}"`), 'HTML base must match the Pages path')
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
console.log(`Verified prerendered profile, ${assets.length} asset references, sync hash and PDF font chunks at ${base}`)
