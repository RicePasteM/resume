import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'devalue'
import { validateResume, extractResume, extractResumeSnapshot, validateTranslations, validateManifest, synchronize } from './sync-resume.mjs'

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

test('extracts all language dictionaries from Nuxt state and rejects missing translations', () => {
  const resume = { ...profile, summary: '研究简介' }
  const bundle = { sourceLocale: 'zh-CN', locales: {
    en: { '研究简介': 'Research summary' }, 'zh-TW': { '研究简介': '研究簡介' }, ja: { '研究简介': '研究概要' }
  } }
  const html = `<script id="__NUXT_DATA__">${stringify({ data: { 'active-resume': resume }, state: { '$sresume-translations': bundle } })}</script>`
  assert.deepEqual(extractResumeSnapshot(html), { resume, translations: bundle })
  assert.equal(validateTranslations(resume, bundle), bundle)
  assert.throws(() => validateTranslations(resume, { locales: { en: {} } }), /incomplete/)
})

test('keeps local translations before the source deployment and adopts the source bundle afterward', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-translations-'))
  const resume = { ...profile, summary: '研究简介' }
  const bundle = { sourceLocale: 'zh-CN', locales: Object.fromEntries(['en', 'zh-TW', 'ja'].map(locale => [locale, { '研究简介': `Translation ${locale}` }])) }
  let remoteBundle
  try {
    await mkdir(join(dir, 'app/i18n'), { recursive: true })
    await writeFile(join(dir, 'app/i18n/resume-content.json'), JSON.stringify(bundle))
    const get = async url => Buffer.from(String(url).endsWith('/resume')
      ? `<script id="__NUXT_DATA__">${stringify({ data: { 'active-resume': resume }, state: remoteBundle ? { '$sresume-translations': remoteBundle } : {} })}</script>`
      : String(url).endsWith('.json') ? JSON.stringify(manifest) : 'abc')
    await synchronize(dir, get)
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'app/i18n/resume-content.json'))), bundle)
    remoteBundle = structuredClone(bundle)
    remoteBundle.locales.en['研究简介'] = 'Updated source translation'
    await synchronize(dir, get)
    assert.equal(JSON.parse(await readFile(join(dir, 'app/i18n/resume-content.json'))).locales.en['研究简介'], 'Updated source translation')
    // The live API may change before the source's next translation build.
    // Cached exact-source translations fill gaps without replacing source edits.
    delete remoteBundle.locales.ja['研究简介']
    await synchronize(dir, get)
    const combined = JSON.parse(await readFile(join(dir, 'app/i18n/resume-content.json')))
    assert.equal(combined.locales.ja['研究简介'], bundle.locales.ja['研究简介'])
    assert.equal(combined.locales.en['研究简介'], 'Updated source translation')
  } finally { await rm(dir, { recursive: true, force: true }) }
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
