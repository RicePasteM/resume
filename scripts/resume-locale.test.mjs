import test from 'node:test'
import assert from 'node:assert/strict'
import { collectResumeStrings, localizeResume } from '../app/utils/resumeLocale.js'
import { filterResumeItems } from '../app/utils/resumePublications.js'

const source = {
  name: '胡张驰（Zhangchi Hu）', phone: 'wechat-id', email: 'mail@example.com', website: 'https://example.com',
  headline: '视觉研究', summary: '研究简介', location: '中国合肥',
  sections: [{ id: 4, section_key: 'publications', title: '论文', items: [{
    id: 12, title: 'Paper: Official Title', subtitle: '中文副标题', start_date: '2026.09',
    is_visible: true, is_featured: true, authors: [{ name: '张三', is_self: true, is_co_first: true }],
    points: [{ id: 1, content: '**精度**达到 *81.8%*。' }], links: [{ label: '项目主页', url: 'https://example.com/paper' }]
  }] }]
}
const translations = { locales: { en: {
  '视觉研究': 'Vision Research', '研究简介': 'Research summary', '中国合肥': 'Hefei, China',
  '论文': 'Publications', '中文副标题': 'Translated subtitle',
  '**精度**达到 *81.8%*。': '**Accuracy** reaches *81.8%*.', '项目主页': 'Project page'
} } }

test('collects resume prose while excluding author identities, identifiers and contact URLs', () => {
  assert.deepEqual(collectResumeStrings(source).sort(), Object.keys(translations.locales.en).sort())
})

test('language changes translate all content levels without changing authorship, links or selection', () => {
  const before = structuredClone(source)
  const result = localizeResume(source, 'en', translations)
  assert.equal(result.summary, 'Research summary')
  assert.equal(result.sections[0].title, 'Publications')
  assert.equal(result.sections[0].items[0].subtitle, '')
  assert.equal(result.sections[0].items[0].points[0].content, '**Accuracy** reaches *81.8%*.')
  assert.equal(result.sections[0].items[0].links[0].label, 'Project page')
  const item = result.sections[0].items[0]
  assert.deepEqual(item.authors, source.sections[0].items[0].authors)
  assert.equal(item.start_date, '2026.09')
  assert.equal(item.links[0].url, 'https://example.com/paper')
  assert.deepEqual(filterResumeItems(result.sections[0], true).map(item => item.id), [12])
  assert.deepEqual(source, before)
  assert.equal(localizeResume(source, 'zh-CN', translations), source)
})

test('new or untranslated source text stays readable until translations are regenerated', () => {
  assert.equal(localizeResume(source, 'ja', translations).summary, source.summary)
  assert.equal(localizeResume({ ...source, summary: '新内容' }, 'en', translations).summary, '新内容')
})


test('English omits publication translated titles while other languages and experience subtitles remain intact', () => {
  const profile = structuredClone(source)
  profile.sections.push({ id: 5, section_key: 'experience', title: 'Experience', items: [{ title: 'Project', subtitle: '中文副标题' }] })
  const en = localizeResume(profile, 'en', translations)
  assert.equal(en.sections[0].items[0].title, 'Paper: Official Title')
  assert.equal(en.sections[0].items[0].subtitle, '')
  assert.equal(en.sections[1].items[0].subtitle, 'Translated subtitle')
  for (const locale of ['zh-CN', 'zh-TW', 'ja']) {
    assert.equal(localizeResume(profile, locale, translations).sections[0].items[0].subtitle, '中文副标题')
  }
  assert.equal(profile.sections[0].items[0].subtitle, '中文副标题', 'source data and translation cache remain unchanged')
})
