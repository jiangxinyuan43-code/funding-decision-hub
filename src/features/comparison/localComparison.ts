import type { ComparisonAnalysis, PCBuild } from '../../types/models'
import { componentLabels, type ComponentKey } from '../../types/models'

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
}

function needsConfirmation(value: string, confidence: number) {
  return !value.trim() || confidence < 0.75 || /未知|未明确|待确认/.test(value)
}

export function compareBuildsLocally(builds: PCBuild[]): ComparisonAnalysis {
  if (builds.length < 2) return { coreDifferences: [], risks: {}, priceNotes: [], usageNotes: [], unknowns: [], source: 'local' }
  const keys = Object.keys(componentLabels) as ComponentKey[]
  const differences = keys
    .filter((key) => new Set(builds.map((build) => build.components[key].value || '未明确')).size > 1)
    .map((key) => `${componentLabels[key]}：${builds.map((build) => `${build.title.replace(/方案$/, '')}为 ${build.components[key].value || '未明确'}`).join('；')}`)

  const risksByBuild = Object.fromEntries(
    builds.map((build) => {
      const checks = keys
        .filter((key) => needsConfirmation(build.components[key].value, build.components[key].confidence))
        .map((key) => `${componentLabels[key]}${build.components[key].value ? '信息待核验' : '未明确'}`)
      if (!build.price) checks.push('当前报价未填写')
      if (!build.store.trim()) checks.push('店铺信息未填写')
      return [build.title, unique([...checks, ...(build.analysis?.risks ?? []), ...(build.analysis?.unknowns ?? [])])]
    }),
  )
  const unknowns = unique(
    builds.flatMap((build) =>
      keys
        .filter((key) => needsConfirmation(build.components[key].value, build.components[key].confidence))
        .map((key) => `${build.title}：${componentLabels[key]}${build.components[key].value ? '待核验' : '未明确'}`),
    ),
  )
  const priced = builds.filter((build) => build.price > 0)
  const prices = [...priced].sort((a, b) => a.price - b.price)
  const priceNotes = priced.length
    ? [
        ...priced.map((build) => `${build.title}当前报价 ¥${build.price.toLocaleString('zh-CN')}`),
        ...(prices.length > 1 && prices[0].price !== prices[prices.length - 1].price
          ? [`价格区间 ¥${prices[0].price.toLocaleString('zh-CN')} - ¥${prices[prices.length - 1].price.toLocaleString('zh-CN')}，最低价方案比最高价少 ¥${(prices[prices.length - 1].price - prices[0].price).toLocaleString('zh-CN')}`]
          : []),
      ]
    : ['各方案尚未录入有效报价，暂无法做价格判断。']

  return {
    coreDifferences: differences.length ? differences : ['当前已录入的核心硬件字段没有差异；请以各方案的待核验项和报价为重点。'],
    risks: risksByBuild,
    priceNotes,
    usageNotes: ['游戏优先看 GPU 与帧时间', '本地 AI 优先看 GPU 显存', '后续升级重点确认主板、电源和机箱兼容性'],
    unknowns,
    source: 'local',
  }
}

export function mergeComparisonWithAI(baseline: ComparisonAnalysis, generated: ComparisonAnalysis): ComparisonAnalysis {
  const risks: Record<string, string[]> = { ...baseline.risks }
  for (const [name, items] of Object.entries(generated.risks)) {
    const matchingName = Object.keys(baseline.risks).find((title) => name === title || name.includes(title) || title.includes(name)) ?? name
    risks[matchingName] = unique([...(risks[matchingName] ?? []), ...items])
  }
  return {
    coreDifferences: unique([...generated.coreDifferences, ...baseline.coreDifferences]),
    risks,
    priceNotes: unique([...generated.priceNotes, ...baseline.priceNotes]),
    usageNotes: unique([...generated.usageNotes, ...baseline.usageNotes]),
    unknowns: unique([...generated.unknowns, ...baseline.unknowns]),
    source: 'hybrid',
  }
}
