// Include layout punctuation and printable ASCII as well as every supplied language.
export function collectPdfCodePoints(...sources) {
  const points = new Set(Array.from({ length: 95 }, (_, index) => index + 32))
  const visit = value => {
    if (typeof value === 'string') {
      for (const character of value) {
        const point = character.codePointAt(0)
        if (point >= 32) points.add(point)
      }
    } else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(['•†—–−', ...sources])
  return [...points].sort((a, b) => a - b)
}
