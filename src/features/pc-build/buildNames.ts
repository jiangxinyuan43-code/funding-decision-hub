import type { PCBuild } from '../../types/models'

export function schemeNameAt(index: number) {
  let value = Math.max(0, Math.floor(index)) + 1
  let suffix = ''

  while (value > 0) {
    value -= 1
    suffix = String.fromCharCode(65 + (value % 26)) + suffix
    value = Math.floor(value / 26)
  }

  return `方案${suffix}`
}

export function orderBuildsForNaming(builds: PCBuild[]) {
  return [...builds].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export function buildSchemeNameMap(builds: PCBuild[]) {
  const ordered = orderBuildsForNaming(builds)
  const result: Record<string, string> = {}
  const used = new Set<string>()

  for (const build of ordered) {
    if (/^方案[A-Z]+$/.test(build.schemeName ?? '') && !used.has(build.schemeName!)) {
      result[build.id] = build.schemeName!
      used.add(build.schemeName!)
    }
  }

  let index = 0
  for (const build of ordered) {
    if (result[build.id]) continue
    while (used.has(schemeNameAt(index))) index += 1
    result[build.id] = schemeNameAt(index)
    used.add(result[build.id])
    index += 1
  }

  return result
}
