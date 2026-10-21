import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { Font } from 'fonteditor-core'
import { collectPdfCodePoints } from '../app/utils/resumePdfCharacters.js'

export async function preparePdfFonts(root = fileURLToPath(new URL('../', import.meta.url))) {
  const readJson = path => readFile(join(root, path), 'utf8').then(JSON.parse)
  const resume = await readJson('app/data/resume-snapshot.json').catch(() => readJson('app/data/resume.json'))
  const translations = await readJson('app/i18n/resume-content.json')
  const labels = await Promise.all(['zh-CN', 'zh-TW', 'en', 'ja'].map(async locale => (await readJson(`app/i18n/locales/${locale}.json`)).resume))
  const codePoints = collectPdfCodePoints(resume, translations, labels)
  const output = join(root, 'public/fonts/resume')
  await mkdir(output, { recursive: true })
  const fonts = {}
  for (const [style, name] of [['normal', 'songti-sc-regular'], ['bold', 'songti-sc-bold']]) {
    const source = await readFile(join(root, `app/assets/pdf-fonts/${name}.ttf`)).catch(async () => {
      const folder = join(root, `public/fonts/chunks/${name}`)
      const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'))
      const chunks = await Promise.all(manifest.chunks.map(chunk => readFile(join(folder, chunk.file))))
      const bytes = Buffer.concat(chunks)
      if (bytes.length !== manifest.size) throw new Error(`Incomplete source font: ${name}`)
      return bytes
    })
    const font = Font.create(source, { type: 'ttf', subset: codePoints, hinting: true })
    const bytes = Buffer.from(font.write({ type: 'ttf', hinting: true }))
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
    const file = `${name}-${hash}.ttf`
    await writeFile(join(output, file), bytes)
    fonts[style] = { file, size: bytes.length }
    console.log(`PDF ${style}: ${source.length.toLocaleString()} -> ${bytes.length.toLocaleString()} bytes (${codePoints.length} characters)`)
  }
  // Publish the manifest only when both fonts are complete. Hashes invalidate old caches.
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ version: 1, codePoints, fonts })}\n`)
  return { codePoints, fonts }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await preparePdfFonts()
