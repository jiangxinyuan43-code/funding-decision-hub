import { z } from 'zod'

const componentKeys = ['cpu', 'gpu', 'vram', 'motherboard', 'ram', 'ramSpeed', 'ssd', 'psu', 'cooler', 'case'] as const

const fieldAliases: Record<(typeof componentKeys)[number], string[]> = {
  cpu: ['cpu', 'CPU', '处理器'],
  gpu: ['gpu', 'GPU', '显卡'],
  vram: ['vram', 'VRAM', '显存'],
  motherboard: ['motherboard', 'mainboard', '主板'],
  ram: ['ram', 'RAM', 'memory', '内存'],
  ramSpeed: ['ramSpeed', 'memorySpeed', '内存频率'],
  ssd: ['ssd', 'SSD', 'storage', '硬盘'],
  psu: ['psu', 'PSU', 'powerSupply', '电源'],
  cooler: ['cooler', 'cooling', '散热'],
  case: ['case', 'chassis', '机箱'],
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function first(source: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => source[key]).find((value) => value !== undefined && value !== null)
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function field(value: unknown) {
  if (typeof value === 'string') return { value: value.trim(), confidence: value.trim() ? 0.7 : 0 }
  const source = record(value)
  if (!source) return { value: '', confidence: 0 }
  const resolved = text(first(source, ['value', 'model', 'name', 'text', '型号']))
  const rawConfidence = Number(first(source, ['confidence', 'score', '置信度']))
  const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence)) : resolved ? 0.7 : 0
  return { value: resolved, confidence }
}

function list(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  const resolved = text(value)
  return resolved ? [resolved] : []
}

function comparisonRisks(value: unknown) {
  if (Array.isArray(value)) {
    const items = list(value)
    const grouped: Record<string, string[]> = {}
    for (const item of items) {
      const separator = item.search(/[：:]/)
      const name = separator > 0 ? item.slice(0, separator).trim() : '模型补充核验'
      const detail = separator > 0 ? item.slice(separator + 1).trim() : item
      if (detail) grouped[name] = [...(grouped[name] ?? []), detail]
    }
    return grouped
  }
  const source = record(value)
  if (!source) {
    const items = list(value)
    return items.length ? { '模型补充核验': items } : {}
  }
  return Object.fromEntries(
    Object.entries(source)
      .map(([name, items]) => [text(name) || '模型补充核验', list(items)])
      .filter((entry) => entry[1].length > 0),
  )
}

function normalizeComparison(value: unknown) {
  const source = record(value)
  if (!source) return value
  return {
    coreDifferences: list(first(source, ['coreDifferences', 'differences', 'keyDifferences', '核心差异', '差异'])),
    risks: comparisonRisks(first(source, ['risks', 'riskNotes', 'warnings', '风险', '风险提示', '待核验'])),
    priceNotes: list(first(source, ['priceNotes', 'priceAnalysis', 'prices', '价格', '价格分析'])),
    usageNotes: list(first(source, ['usageNotes', 'scenarios', 'recommendations', 'usage', '使用场景', '建议'])),
    unknowns: list(first(source, ['unknowns', 'missing', 'gaps', '待确认', '信息缺口', '未知项'])),
  }
}

function price(value: unknown) {
  if (typeof value === 'number') return Math.max(0, value)
  const resolved = Number(text(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(resolved) ? Math.max(0, resolved) : 0
}

function platform(value: unknown) {
  const resolved = text(value)
  if (/京东|jd/i.test(resolved)) return '京东'
  if (/天猫|tmall/i.test(resolved)) return '天猫'
  if (/淘宝|taobao/i.test(resolved)) return '淘宝'
  if (/抖音|douyin|tiktok/i.test(resolved)) return '抖音'
  return '其他'
}

function normalizeExtraction(value: unknown) {
  const source = record(value)
  if (!source) return value
  const fields = record(source.fields) ?? record(source.components) ?? record(source.configuration) ?? source
  return {
    title: text(first(source, ['title', 'productTitle', 'productName', 'name', '商品名称'])),
    platform: platform(first(source, ['platform', 'source', '平台'])),
    store: text(first(source, ['store', 'shop', 'seller', '店铺'])),
    price: price(first(source, ['price', 'currentPrice', 'amount', '价格'])),
    fields: Object.fromEntries(componentKeys.map((key) => [key, field(first(fields, fieldAliases[key]))])),
    advantages: list(first(source, ['advantages', 'pros', '优点', '优势'])),
    risks: list(first(source, ['risks', 'warnings', '风险', '注意事项'])),
    unknowns: list(first(source, ['unknowns', 'missing', '待确认', '未知项'])),
    summary: text(first(source, ['summary', 'conclusion', 'analysis', '总结', '结论'])),
  }
}

const fieldSchema = z.object({
  value: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0),
})

const canonicalExtractionSchema = z.object({
  title: z.string().default(''),
  platform: z.enum(['京东', '淘宝', '天猫', '抖音', '其他']).default('其他'),
  store: z.string().default(''),
  price: z.number().nonnegative().default(0),
  fields: z.object({
    cpu: fieldSchema,
    gpu: fieldSchema,
    vram: fieldSchema,
    motherboard: fieldSchema,
    ram: fieldSchema,
    ramSpeed: fieldSchema,
    ssd: fieldSchema,
    psu: fieldSchema,
    cooler: fieldSchema,
    case: fieldSchema,
  }),
  advantages: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  summary: z.string().default(''),
})

export const extractionSchema = z.preprocess(normalizeExtraction, canonicalExtractionSchema)

export type ExtractionResult = z.infer<typeof extractionSchema>

const canonicalComparisonSchema = z.object({
  coreDifferences: z.array(z.string()).default([]),
  risks: z.record(z.array(z.string())).default({}),
  priceNotes: z.array(z.string()).default([]),
  usageNotes: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
})

export const comparisonSchema = z.preprocess(normalizeComparison, canonicalComparisonSchema)

export type AIComparisonResult = z.infer<typeof comparisonSchema>

export const extractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    platform: { type: 'string', enum: ['京东', '淘宝', '天猫', '抖音', '其他'] },
    store: { type: 'string' },
    price: { type: 'number' },
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        componentKeys.map((key) => [
          key,
          {
            type: 'object',
            additionalProperties: false,
            properties: { value: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } },
            required: ['value', 'confidence'],
          },
        ]),
      ),
      required: ['cpu', 'gpu', 'vram', 'motherboard', 'ram', 'ramSpeed', 'ssd', 'psu', 'cooler', 'case'],
    },
    advantages: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    unknowns: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['title', 'platform', 'store', 'price', 'fields', 'advantages', 'risks', 'unknowns', 'summary'],
} as const

export const comparisonJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    coreDifferences: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    priceNotes: { type: 'array', items: { type: 'string' } },
    usageNotes: { type: 'array', items: { type: 'string' } },
    unknowns: { type: 'array', items: { type: 'string' } },
  },
  required: ['coreDifferences', 'risks', 'priceNotes', 'usageNotes', 'unknowns'],
} as const
