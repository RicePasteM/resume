import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parse } from 'devalue'

export const SOURCE_URL = 'https://ricepastem.cafe/resume'
const root = fileURLToPath(new URL('../', import.meta.url))

export function validateResume(resume) {
  if (!resume || typeof resume.name !== 'string' || !resume.name.trim()) {
    throw new Error('The source page did not contain a valid resume profile')
  }
  if (!Array.isArray(resume.sections) || !resume.sections.length ||
      !resume.sections.some(section => section.is_visible !== false && Array.isArray(section.items) && section.items.length)) {
    throw new Error('The public resume has no populated sections; refusing to publish fallback content')
  }
  return resume
}

export function extractResume(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  const script = scripts.find(match => /\bid\s*=\s*["']__NUXT_DATA__["']/i.test(match[1]))
  if (!script) throw new Error('Missing Nuxt payload in the source page')
  // Decode Nuxt's JSON serialization without executing any source-page JavaScript.
  const identity = value => value
  const payload = parse(script[2], { ShallowReactive: identity, Reactive: identity, Ref: identity, ShallowRef: identity, Set: values => new Set(values) })
  return validateResume(payload?.data?.['active-resume'])
}

export function validateManifest(manifest) {
  if (!Number.isSafeInteger(manifest?.size) || manifest.size <= 0 || !Array.isArray(manifest.chunks) || !manifest.chunks.length ||
      manifest.chunks.some(chunk => !/^part-\d+\.bin$/.test(chunk.file) || !Number.isSafeInteger(chunk.size) || chunk.size <= 0) ||
      manifest.chunks.reduce((size, chunk) => size + chunk.size, 0) !== manifest.size) {
    throw new Error('Invalid PDF font manifest')
  }
  return manifest
}

async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }
}

async function save(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

export async function synchronize(destination = root, get = download) {
  const resume = extractResume((await get(SOURCE_URL)).toString())
  // Reuse cached fonts when the source manifest matches; download updates only.
  for (const font of ['songti-sc-regular', 'songti-sc-bold']) {
    const prefix = `fonts/chunks/${font}/`
    const manifestBytes = await get(new URL(`${prefix}manifest.json`, SOURCE_URL))
    const manifest = validateManifest(JSON.parse(manifestBytes))
    const localManifest = await readFile(join(destination, 'public', prefix, 'manifest.json')).catch(() => null)
    let cached = localManifest?.equals(manifestBytes)
    for (const chunk of manifest.chunks) {
      const local = await stat(join(destination, 'public', prefix, chunk.file)).catch(() => null)
      if (local?.size !== chunk.size) cached = false
    }
    if (cached) {
      console.log(`Using verified cached PDF font: ${font}`)
      continue
    }
    for (let offset = 0; offset < manifest.chunks.length; offset += 3) {
      const results = await Promise.allSettled(manifest.chunks.slice(offset, offset + 3).map(async chunk => {
        const bytes = await get(new URL(prefix + chunk.file, SOURCE_URL))
        if (bytes.length !== chunk.size) throw new Error(`Incomplete font chunk: ${font}/${chunk.file}`)
        await save(join(destination, 'public', prefix, chunk.file), bytes)
      }))
      const failed = results.find(result => result.status === 'rejected')
      if (failed) throw failed.reason
    }
    await save(join(destination, 'public', prefix, 'manifest.json'), manifestBytes)
    console.log(`Downloaded PDF font: ${font}`)
  }
  // Only replace the resume snapshot after every upstream resource passes validation.
  const content = `${JSON.stringify(resume, null, 2)}\n`
  const metadata = {
    source: SOURCE_URL,
    format: 'nuxt-ssr-payload',
    fetchedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(content).digest('hex')
  }
  await save(join(destination, 'app/data/resume.json'), content)
  await save(join(destination, 'public/sync.json'), `${JSON.stringify(metadata, null, 2)}\n`)
  console.log(`Synced ${resume.name}: ${resume.sections.length} sections (${metadata.sha256.slice(0, 12)})`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  await synchronize()
}
