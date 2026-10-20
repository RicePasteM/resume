import { ref } from 'vue'

export const usePublicationPoints = () => {
  const expanded = ref(new Set())
  const hasPoints = item => Array.isArray(item.points) && item.points.length > 0
  const key = (section, item) => JSON.stringify([section.id ?? section.section_key ?? section.title, item.id ?? item.title])
  const itemsWithPoints = section => (section.items || []).filter(item => item.is_visible !== false && hasPoints(item))
  const isExpanded = (section, item) => expanded.value.has(key(section, item))
  const allExpanded = section => {
    const items = itemsWithPoints(section)
    return items.length > 0 && items.every(item => isExpanded(section, item))
  }
  const toggle = (section, item) => {
    if (!hasPoints(item)) return
    const itemKey = key(section, item)
    if (expanded.value.has(itemKey)) expanded.value.delete(itemKey)
    else expanded.value.add(itemKey)
  }
  const toggleAll = section => {
    const shouldExpand = !allExpanded(section)
    itemsWithPoints(section).forEach(item => {
      const itemKey = key(section, item)
      if (shouldExpand) expanded.value.add(itemKey)
      else expanded.value.delete(itemKey)
    })
  }
  return { hasPoints, isExpanded, allExpanded, toggle, toggleAll, hasExpandableItems: section => itemsWithPoints(section).length > 0,
    pointsId: (section, item) => `publication-points-${encodeURIComponent(key(section, item))}` }
}
