export const TERMINAL_VISIBLE_LINES = 5
export const TERMINAL_BUFFER_LINES = 10

// Textarea selections use UTF-16 offsets. Preserve them when normalizing newlines
// and dropping the oldest lines, including selections that span trimmed history.
export function limitTerminalBuffer(value, start = value.length, end = start) {
  const text = value.replace(/\r\n?/g, '\n')
  const normalizedStart = value.slice(0, start).replace(/\r\n?/g, '\n').length
  const normalizedEnd = value.slice(0, end).replace(/\r\n?/g, '\n').length
  const lines = text.split('\n')
  const discardedLines = Math.max(0, lines.length - TERMINAL_BUFFER_LINES)
  const discardedLength = lines.slice(0, discardedLines).reduce((length, line) => length + line.length + 1, 0)
  const buffer = text.slice(discardedLength)
  const adjustOffset = offset => Math.max(0, Math.min(buffer.length, offset - discardedLength))
  return { value: buffer, start: adjustOffset(normalizedStart), end: adjustOffset(normalizedEnd) }
}
