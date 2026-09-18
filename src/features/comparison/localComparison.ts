import type { ComparisonAnalysis, PCBuild } from '../../types/models'
import { componentLabels, type ComponentKey } from '../../types/models'

export function compareBuildsLocally(builds: PCBuild[]): ComparisonAnalysis {
  if (builds.length < 2) return { coreDifferences: [], risks: {}, priceNotes: [], usageNotes: [], unknowns: [] }
  const keys = Object.keys(componentLabels) as ComponentKey[]
  const differences = keys
    .filter((key) => new Set(builds.map((build) => build.components[key].value || '未明确')).size > 1)
    .slice(0, 4)
    .map((key) => `${componentLabels[key]}：${builds.map((build) => `${build.title.replace(/方案$/, '')}为 ${build.components[key].value || '未明确'}`).join('；')}`)

  const prices = [...builds].sort((a, b) => a.price - b.price)
  const risks = Object.fromEntries(
    builds.map((build) => [
      build.title,
      (Object.keys(componentLabels) as ComponentKey[])
        .filter((key) => !build.components[key].value || /未知|未明确/.test(build.components[key].value) || build.components[key].confidence < 0.75)
        .map((key) => `${componentLabels[key]}待确认`),
    ]),
  )
  const unknowns = Array.from(new Set(Object.values(risks).flat()))

  return {
    coreDifferences: differences,
    risks,
    priceNotes: [`${prices[0].title}价格最低，比${prices[prices.length - 1]?.title}少 ¥${(prices[prices.length - 1]?.price ?? 0) - prices[0].price}`],
    usageNotes: ['游戏优先看 GPU 与帧时间', '本地 AI 优先看 GPU 显存', '后续升级重点确认主板、电源和机箱兼容性'],
    unknowns,
  }
}
