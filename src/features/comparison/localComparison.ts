import type { ComparisonAnalysis, ComparisonDimension, ComparisonRanking, PCBuild } from '../../types/models'
import { componentLabels, type ComponentKey } from '../../types/models'

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
}

function needsConfirmation(value: string, confidence: number) {
  return !value.trim() || confidence < 0.75 || /未知|未明确|待确认/.test(value)
}

const weights = [
  { key: 'performance' as const, label: '性能', weight: 35, reason: '游戏帧数和生产力速度决定主要体验。' },
  { key: 'value' as const, label: '性价比', weight: 20, reason: '预算有限，价格差异会直接影响购买决策。' },
  { key: 'compatibility' as const, label: '兼容性与稳定性', weight: 15, reason: '电源、主板和配件型号不清会放大整机风险。' },
  { key: 'upgrade' as const, label: '扩展与升级', weight: 12, reason: '优先保留内存、硬盘和 AM5 平台的后续空间。' },
  { key: 'thermals' as const, label: '散热与噪音', weight: 8, reason: '持续负载下的温度和噪音影响长期体验。' },
  { key: 'afterSales' as const, label: '售后与风险', weight: 10, reason: '整机配件来源和保修信息不全时，风险需要单独计入。' },
]

function has(build: PCBuild, key: ComponentKey) {
  const field = build.components[key]
  return !needsConfirmation(field.value, field.confidence)
}

function modelScore(value: string, pairs: Array<[RegExp, number]>, fallback: number) {
  const match = pairs.find(([pattern]) => pattern.test(value))
  return match?.[1] ?? fallback
}

function scoreBuild(build: PCBuild, all: PCBuild[]) {
  const gpu = modelScore(build.components.gpu.value, [[/5090/i, 100], [/5080/i, 94], [/5070\s*Ti/i, 86], [/5070/i, 78], [/5060\s*Ti/i, 61], [/5060/i, 54], [/4080/i, 90], [/4070\s*Ti/i, 79], [/4070/i, 71]], 42)
  const cpu = modelScore(build.components.cpu.value, [[/9950X3D/i, 100], [/9800X3D/i, 95], [/7950X3D/i, 91], [/7900X3D/i, 86], [/7800X3D/i, 82], [/9700X/i, 79], [/9600X/i, 68]], 55)
  const performance = Math.round(Math.min(100, gpu * .68 + cpu * .32))
  const unknownCount = (Object.keys(componentLabels) as ComponentKey[]).filter((key) => !has(build, key)).length
  const compatibility = Math.max(35, Math.round(94 - unknownCount * 7 - (has(build, 'psu') ? 0 : 8) - (has(build, 'motherboard') ? 0 : 5)))
  const upgrade = Math.max(35, Math.round(68 + (has(build, 'motherboard') ? 12 : 0) + (has(build, 'ram') ? 8 : 0) + (has(build, 'ssd') ? 6 : 0) + (/64GB|96GB|128GB/i.test(build.components.ram.value) ? 5 : 0)))
  const thermals = Math.max(35, Math.round(76 + (has(build, 'cooler') ? 8 : -12) + (has(build, 'case') ? 7 : -13) - (unknownCount > 4 ? 6 : 0)))
  const afterSales = Math.max(35, Math.round(65 + (build.platform !== '其他' ? 12 : 0) + (build.store ? 10 : 0) + (build.url ? 5 : 0) - unknownCount * 3))
  const maxPerformance = Math.max(...all.map((item) => modelScore(item.components.gpu.value, [[/5090/i, 100], [/5080/i, 94], [/5070\s*Ti/i, 86], [/5070/i, 78], [/5060\s*Ti/i, 61], [/5060/i, 54]], 42) * .68 + modelScore(item.components.cpu.value, [[/9950X3D/i, 100], [/9800X3D/i, 95], [/7800X3D/i, 82]], 55) * .32), 1)
  const relativePerformance = performance / maxPerformance
  const value = Math.max(35, Math.min(100, Math.round(relativePerformance * 72 + (build.price > 0 ? Math.max(0, 28 - build.price / 1200) : 0) - unknownCount * 2)))
  const scores = { performance, value, compatibility, upgrade, thermals, afterSales }
  const total = Math.round(weights.reduce((sum, item) => sum + scores[item.key] * item.weight / 100, 0) * 10) / 10
  return { scores, total, unknownCount }
}

function shortTitle(title: string, index: number) {
  const match = title.match(/(9800X3D|7800X3D|9950X3D|7950X3D).*?(RTX\s*\d{4}(?:\s*Ti)?)/i)
  return match ? `${match[1]} + ${match[2]}` : `方案${String.fromCharCode(65 + index)}`
}

function buildReport(builds: PCBuild[]) {
  const ranked = builds.map((build, index) => ({ build, index, result: scoreBuild(build, builds) })).sort((a, b) => b.result.total - a.result.total)
  const rankings: ComparisonRanking[] = ranked.map(({ build, index, result }, rankIndex) => {
    const recommendation = rankIndex === 0 ? '首选' : rankIndex === 1 ? '次选' : result.unknownCount >= 4 || result.total < 65 ? '不建议' : '可考虑'
    const headline = recommendation === '首选' ? '综合性能和风险最平衡' : recommendation === '次选' ? '预算更友好，但需要接受取舍' : recommendation === '不建议' ? '关键配件信息不足，先不要下单' : '可以考虑，优先补齐待确认项'
    return { buildId: build.id, title: build.title, shortTitle: shortTitle(build.title, index), rank: rankIndex + 1, total: result.total, recommendation, scores: result.scores, headline }
  })
  const winner = rankings[0]
  const runnerUp = rankings[1]
  const avoid = rankings.find((item) => item.recommendation === '不建议') ?? rankings[rankings.length - 1]
  const winnerBuild = builds.find((build) => build.id === winner?.buildId)
  const coreReason = winner && winnerBuild ? `${winner.shortTitle}以 ${winner.total} 分排第一，主要靠 ${winner.scores.performance} 分性能和 ${winner.scores.compatibility} 分稳定性；${winnerBuild.components.motherboard.value || '主板'}仍需确认。` : '当前方案不足两个，无法形成可靠排名。'
  return {
    assumption: '未设置专门用途时，按“2K 游戏 + 日常生产力 + 预算敏感”分配权重；未知型号会在稳定性、散热和售后维度扣分。',
    weights,
    rankings,
    winner: winner?.shortTitle ?? '未知',
    runnerUp: runnerUp?.shortTitle ?? '暂无',
    avoid: avoid?.shortTitle ?? '暂无',
    coreReason,
    experience: [
      '游戏：显卡决定 2K 分辨率下的主要帧数，X3D 处理器更适合高刷和 1% Low；实际帧数仍受游戏、画质、驱动和散热影响。',
      '生产力：当前记录缺少具体软件和项目规模，暂不伪造渲染、编译或 AI 的精确耗时；核心差异仍看 CPU 核心数、显卡显存和内存容量。',
      '多任务：32GB 可覆盖常规办公和游戏，64GB 对浏览器多开、剪辑和本地 AI 更从容；内存单双通道需以实物或订单确认。',
      '未来 3 至 5 年：优先确认电源、主板和 SSD 具体型号；这些字段不明确时，性能再高也不代表整机长期可靠。',
    ],
    valueNotes: ranked.map(({ build, result }) => `${shortTitle(build.title, 0)}：${build.price > 0 ? `¥${build.price.toLocaleString('zh-CN')}，综合 ${result.total} 分` : '价格未知，暂不判断每元性能'}。${result.unknownCount ? `有 ${result.unknownCount} 项硬件信息需确认。` : '配置完整度较好。'}`),
    priceFreshness: '价格判断基于当前录入报价和记录时间；促销、地区、库存和赠品变化可能改变性价比排序。',
    finalSentence: winner ? `在“2K 游戏 + 日常生产力、预算敏感”的用途下，${winner.shortTitle}更好，因为它在性能、价格和整机风险之间的综合分最高。` : '当前方案不足两个，补齐候选后再做最终推荐。',
  }
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
    report: buildReport(builds),
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
    report: baseline.report,
  }
}
