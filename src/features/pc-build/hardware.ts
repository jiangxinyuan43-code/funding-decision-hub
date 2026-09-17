import type { BuildComponents, ComponentKey, PCBuild } from '../../types/models'

const cpuRules: Array<[RegExp, string]> = [
  [/\b(?:amd\s*)?(?:ryzen\s*)?7?\s*9800x3d\b/i, 'AMD Ryzen 7 9800X3D'],
  [/\b(?:amd\s*)?(?:ryzen\s*)?7?\s*7800x3d\b/i, 'AMD Ryzen 7 7800X3D'],
]

export function normalizeCpu(value: string) {
  const compact = value.replace(/[-_]/g, ' ').trim()
  return cpuRules.find(([pattern]) => pattern.test(compact))?.[1] ?? compact
}

export function normalizeGpu(value: string) {
  const compact = value.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
  const match = compact.match(/(?:nvidia\s*)?(?:geforce\s*)?rtx\s*(\d{4})(?:\s*(ti|super))?/i)
  if (!match) return compact
  const suffix = match[2] ? ` ${match[2].replace(/^./, (char) => char.toUpperCase())}` : ''
  return `NVIDIA GeForce RTX ${match[1]}${suffix}`
}

export function normalizeComponents(components: BuildComponents): BuildComponents {
  return {
    ...components,
    cpu: { ...components.cpu, value: normalizeCpu(components.cpu.value) },
    gpu: { ...components.gpu, value: normalizeGpu(components.gpu.value) },
  }
}

const weightedKeys: ComponentKey[] = ['cpu', 'gpu', 'motherboard', 'ram', 'ssd', 'psu', 'cooler', 'case']

export function calculateCompleteness(components: BuildComponents) {
  const filled = weightedKeys.filter((key) => {
    const value = components[key].value.trim()
    return value && !/未知|未明确/i.test(value)
  }).length
  return Math.round((filled / weightedKeys.length) * 100)
}

export function buildTags(components: BuildComponents, price: number) {
  const tags = [components.cpu.value, components.gpu.value, components.ram.value, components.ssd.value]
    .filter(Boolean)
    .map((tag) => tag.replace(/^AMD Ryzen 7 /, '').replace(/^NVIDIA GeForce /, ''))
  if (!components.psu.value || /未知|未明确/i.test(components.psu.value)) tags.push('电源待确认')
  if (!components.motherboard.value || /未知|未明确/i.test(components.motherboard.value)) tags.push('主板待确认')
  if (price > 0 && price < 14_000) tags.push('价格较低')
  return Array.from(new Set(tags))
}

export function findLikelyDuplicate(candidate: Pick<PCBuild, 'url' | 'store' | 'title' | 'components'>, builds: PCBuild[]) {
  return builds.find((build) => {
    if (candidate.url && build.url && candidate.url === build.url) return true
    const sameStore = candidate.store.trim() && build.store.trim() === candidate.store.trim()
    const sameCpu = candidate.components.cpu.value && build.components.cpu.value === candidate.components.cpu.value
    const sameGpu = candidate.components.gpu.value && build.components.gpu.value === candidate.components.gpu.value
    const similarTitle = candidate.title.trim() && build.title.includes(candidate.title.trim().slice(0, 8))
    return Boolean(sameStore && sameCpu && sameGpu && similarTitle)
  })
}

export function componentUnknowns(components: BuildComponents) {
  return weightedKeys
    .filter((key) => !components[key].value || /未知|未明确/i.test(components[key].value) || components[key].confidence < 0.75)
    .map((key) => key)
}
