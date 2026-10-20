<template>
  <div ref="terminalRoot" class="resume-terminal" :style="asciiCursorColumns">
    <pre v-if="!editable" class="terminal-output" role="img" aria-label="RESUME"><span ref="asciiArt" class="ascii-art" @animationend="finishPrinting">{{ initialText }}</span><span class="printing-cursor" aria-hidden="true">█</span></pre>
    <div
      v-else
      class="terminal-editor"
      @pointerdown.prevent="focusTerminal"
      @click.prevent
      @dblclick.prevent
      @dragstart.prevent
    >
      <textarea
        ref="terminalInput"
        class="terminal-input"
        :class="{ 'is-composing': composing }"
        :value="buffer"
        :rows="TERMINAL_VISIBLE_LINES"
        wrap="off"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        aria-label="简历字符终端"
        aria-description="支持输入、删除和回车。显示五行，保留最近十行内容。"
        @input="handleInput"
        @compositionstart="composing = true"
        @compositionend="finishComposition"
        @select="scheduleCursor"
        @keyup="scheduleCursor"
        @focus="scheduleCursor"
        @scroll="scheduleCursor"
      ></textarea>
      <span
        v-show="cursor.visible && !composing"
        class="editor-cursor"
        :style="{ left: `${cursor.left}px`, top: `${cursor.top}px` }"
        aria-hidden="true"
      >█</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { limitTerminalBuffer, TERMINAL_VISIBLE_LINES } from '~/utils/terminalBuffer.js'

const props = defineProps({ initialText: { type: String, required: true } })
const asciiCursorColumns = computed(() => Object.fromEntries(
  props.initialText.split('\n').map((line, index) => [`--ascii-row-${index}-end`, `${line.length}ch`])
))
const terminalRoot = ref(null)
const asciiArt = ref(null)
const terminalInput = ref(null)
const editable = ref(false)
const composing = ref(false)
const buffer = ref(limitTerminalBuffer(props.initialText).value)
const cursor = ref({ left: 0, top: 0, visible: false })
let measureContext
let resizeObserver
let cursorFrame = 0
let printFallback
let disposed = false

function focusTerminal() {
  const input = terminalInput.value
  if (!input || disposed) return
  // Focusing must preserve the keyboard's caret, including after a mouse click.
  const start = input.selectionStart
  const end = input.selectionEnd
  const direction = input.selectionDirection
  input.focus({ preventScroll: true })
  if (!composing.value) input.setSelectionRange(start, end, direction)
  scheduleCursor()
}

function captureKeyboard(event) {
  if (!editable.value || disposed) return
  // Never steal focus on modifiers or browser/system shortcuts: focusing the
  // textarea clears a page selection before the following copy key arrives.
  if (event.ctrlKey || event.metaKey || ['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) return
  const input = terminalInput.value
  if (!input) return
  if (document.activeElement !== input) focusTerminal()
  // Let the native textarea handle editing, shortcuts and IME composition.
  // Capture before page controls can respond to the same keystroke.
  event.stopPropagation()
  if (event.key === 'Tab' && !event.isComposing && !composing.value) {
    event.preventDefault()
    input.setRangeText('    ', input.selectionStart, input.selectionEnd, 'end')
    applyInput(input)
  }
}

function updateCursor() {
  const input = terminalInput.value
  if (!input || disposed) return
  const style = getComputedStyle(input)
  const lineHeight = parseFloat(style.lineHeight)
  const prefix = input.value.slice(0, input.selectionStart)
  const lines = prefix.split('\n')
  const columnText = lines.at(-1)
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d')
  measureContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const left = measureContext.measureText(columnText).width - input.scrollLeft
  const top = (lines.length - 1) * lineHeight - input.scrollTop
  cursor.value = {
    left,
    top,
    visible: input.selectionStart === input.selectionEnd && top >= -0.5 && top + lineHeight <= input.clientHeight + 1 && left >= 0 && left < input.clientWidth
  }
}

function scheduleCursor() {
  if (disposed) return
  cancelAnimationFrame(cursorFrame)
  cursorFrame = requestAnimationFrame(updateCursor)
}

function keepCaretVisible(input) {
  const lineHeight = parseFloat(getComputedStyle(input).lineHeight)
  const row = input.value.slice(0, input.selectionStart).split('\n').length - 1
  const rowTop = row * lineHeight
  if (rowTop < input.scrollTop) input.scrollTop = rowTop
  else if (rowTop + lineHeight > input.scrollTop + input.clientHeight) {
    input.scrollTop = Math.max(0, (row - TERMINAL_VISIBLE_LINES + 1) * lineHeight)
  }
}

function applyInput(input) {
  const limited = limitTerminalBuffer(input.value, input.selectionStart, input.selectionEnd)
  if (limited.value !== input.value) {
    input.value = limited.value
    input.setSelectionRange(limited.start, limited.end)
  }
  buffer.value = limited.value
  keepCaretVisible(input)
  scheduleCursor()
}

function handleInput(event) {
  // Do not rewrite the value or selection while an IME owns the composition.
  if (composing.value || event.isComposing) {
    buffer.value = event.target.value
    scheduleCursor()
    return
  }
  applyInput(event.target)
}

function finishComposition(event) {
  composing.value = false
  applyInput(event.target)
}

async function finishPrinting() {
  if (editable.value || disposed) return
  clearTimeout(printFallback)
  editable.value = true
  await nextTick()
  const input = terminalInput.value
  if (!input || disposed) return
  input.setSelectionRange(buffer.value.length, buffer.value.length)
  focusTerminal()
  keepCaretVisible(input)
  updateCursor()
}

onMounted(() => {
  window.addEventListener('keydown', captureKeyboard, true)
  resizeObserver = new ResizeObserver(scheduleCursor)
  resizeObserver.observe(terminalRoot.value)
  const animation = asciiArt.value?.getAnimations().find(item => item.animationName?.startsWith('ascii-title-print'))
  // Animation may already be finished before hydration; reduced motion has none.
  if (!animation) finishPrinting()
  else animation.finished.then(finishPrinting).catch(() => {})
  printFallback = setTimeout(finishPrinting, 1600)
})

onUnmounted(() => {
  disposed = true
  window.removeEventListener('keydown', captureKeyboard, true)
  clearTimeout(printFallback)
  cancelAnimationFrame(cursorFrame)
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.resume-terminal {
  --ascii-print-duration: 1.25s;
  --ascii-print-delay: 160ms;
  --ascii-line-height: 1.15em;
  position: relative;
  height: calc(var(--ascii-line-height) * 5);
  line-height: 1.15;
  cursor: default;
  user-select: none;
}

.terminal-output {
  position: relative;
  margin: 0;
  padding: 0;
  border: 0;
  font: inherit;
  color: inherit;
  overflow: hidden;
  white-space: pre;
}

.ascii-art {
  display: block;
  animation: ascii-title-print var(--ascii-print-duration) steps(5, end) var(--ascii-print-delay) both;
}

.printing-cursor {
  position: absolute;
  animation:
    ascii-cursor-position var(--ascii-print-duration) step-end var(--ascii-print-delay) both,
    terminal-cursor-blink 1s step-end infinite;
}

.terminal-editor {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.terminal-input {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-sizing: border-box;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  resize: none;
  outline: none;
  overflow: auto;
  scrollbar-width: none;
  caret-color: transparent;
  cursor: default;
  user-select: none;
}

.terminal-input::-webkit-scrollbar { display: none; }
.terminal-input.is-composing { caret-color: currentColor; }

.editor-cursor {
  position: absolute;
  pointer-events: none;
  animation: terminal-cursor-blink 1s step-end infinite;
}

@keyframes ascii-cursor-position {
  0% { left: 0; top: 0; }
  20% { left: var(--ascii-row-0-end); top: 0; }
  40% { left: var(--ascii-row-1-end); top: var(--ascii-line-height); }
  60% { left: var(--ascii-row-2-end); top: calc(var(--ascii-line-height) * 2); }
  80% { left: var(--ascii-row-3-end); top: calc(var(--ascii-line-height) * 3); }
  100% { left: var(--ascii-row-4-end); top: calc(var(--ascii-line-height) * 4); }
}

@keyframes terminal-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes ascii-title-print {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0); }
}

@media print, (prefers-reduced-motion: reduce) {
  .ascii-art { animation: none; clip-path: none; }
  .printing-cursor {
    animation: none;
    left: var(--ascii-row-4-end);
    top: calc(var(--ascii-line-height) * 4);
  }
  .editor-cursor { animation: none; }
}

@media print {
  .printing-cursor, .editor-cursor { display: none; }
}
</style>
