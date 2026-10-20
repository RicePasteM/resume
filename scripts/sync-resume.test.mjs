import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'devalue'
import { validateResume, extractResume, validateManifest, synchronize } from './sync-resume.mjs'

const profile = { name: 'Test Resume', sections: [{ title: 'Research', items: [{ title: 'Paper', is_featured: true, authors: [{ name: 'Author' }] }] }] }
const page = `<script type="application/json" id="__NUXT_DATA__">${stringify({ data: { 'active-resume': profile } })}</script>`
const manifest = { size: 3, chunks: [{ file: 'part-000.bin', size: 3 }] }

test('rejects empty profiles instead of publishing fallback data', () => {
  for (const payload of [null, {}, { name: 'Test', sections: [] }]) {
    assert.throws(() => validateResume(payload))
  }
  assert.equal(validateResume(profile), profile)
})

test('extracts the actual page snapshot including authors and featured flags', () => {
  assert.deepEqual(extractResume(page), profile)
  assert.throws(() => extractResume('<html>Service unavailable</html>'), /Missing Nuxt payload/)
  assert.throws(() => extractResume('<script id="__NUXT_DATA__">invalid</script>'))
})

test('rejects unsafe paths and inconsistent font lengths', () => {
  assert.equal(validateManifest(manifest), manifest)
  assert.throws(() => validateManifest({ ...manifest, size: 4 }))
  assert.throws(() => validateManifest({ size: 3, chunks: [{ file: '../part-000.bin', size: 3 }] }))
})

test('sync writes a complete snapshot and local PDF font assets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-sync-'))
  try {
    await synchronize(dir, async url => Buffer.from(String(url).endsWith('/resume') ? page : String(url).endsWith('.json') ? JSON.stringify(manifest) : 'abc'))
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'app/data/resume.json'))), profile)
    assert.match(JSON.parse(await readFile(join(dir, 'public/sync.json'))).sha256, /^[a-f0-9]{64}$/)
    assert.equal(await readFile(join(dir, 'public/fonts/chunks/songti-sc-bold/part-000.bin'), 'utf8'), 'abc')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('failed font downloads leave the previous resume snapshot intact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-sync-'))
  try {
    await mkdir(join(dir, 'app/data'), { recursive: true })
    await writeFile(join(dir, 'app/data/resume.json'), 'previous snapshot')
    await assert.rejects(synchronize(dir, async url => {
      if (String(url).endsWith('/resume')) return Buffer.from(page)
      if (String(url).endsWith('.json')) return Buffer.from(JSON.stringify(manifest))
      return Buffer.from('incomplete')
    }), /Incomplete font chunk/)
    assert.equal(await readFile(join(dir, 'app/data/resume.json'), 'utf8'), 'previous snapshot')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
