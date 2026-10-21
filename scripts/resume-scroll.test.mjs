import test from 'node:test'
import assert from 'node:assert/strict'
import { scrollToResumeSection } from '../app/utils/resumeScroll.js'

function scrollFixture(nested = false) {
  const calls = []
  const container = {
    scrollTop: 600,
    clientTop: 2,
    getBoundingClientRect: () => ({ top: nested ? 120 : -container.scrollTop }),
    scrollTo(options) { calls.push(options); this.scrollTop = options.top }
  }
  const doc = { scrollingElement: nested ? {} : container, documentElement: nested ? {} : container }
  const section = contentTop => ({
    ownerDocument: doc,
    closest: () => nested ? container : null,
    getBoundingClientRect: () => ({ top: contentTop - container.scrollTop + (nested ? 122 : 0) })
  })
  return { container, calls, section }
}

for (const nested of [false, true]) {
  test(`${nested ? 'nested viewport' : 'document'} outline navigation moves both ways and repeated clicks stay put`, () => {
    const { container, calls, section } = scrollFixture(nested)
    const lower = section(1500)
    const upper = section(400)
    scrollToResumeSection(lower)
    assert.equal(container.scrollTop, 1408)
    scrollToResumeSection(lower)
    assert.equal(container.scrollTop, 1408, 'clicking the current section does not add the scroll position again')
    scrollToResumeSection(upper)
    assert.equal(container.scrollTop, 308, 'an earlier section scrolls upward')
    scrollToResumeSection(upper)
    assert.equal(container.scrollTop, 308)
    assert.equal(calls[0].behavior, 'smooth')
  })
}

test('sections near the start clamp to zero and honor a custom heading offset', () => {
  const { container, section } = scrollFixture()
  scrollToResumeSection(section(40))
  assert.equal(container.scrollTop, 0)
  scrollToResumeSection(section(400), { offset: 48, behavior: 'instant' })
  assert.equal(container.scrollTop, 352)
})
