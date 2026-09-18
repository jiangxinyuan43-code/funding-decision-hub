import { z } from 'zod'

const dateString = z.string().min(1).max(64)
const shortText = z.string().max(500)
const longText = z.string().max(20_000)
const amount = z.number().finite().nonnegative()
const id = z.string().min(1).max(200)

const fieldValueSchema = z.object({
  value: shortText,
  confidence: z.number().finite().min(0).max(1),
  source: z.enum(['ai', 'manual', 'url', 'ocr']),
  confirmed: z.boolean(),
})

const componentsSchema = z.object({
  cpu: fieldValueSchema,
  gpu: fieldValueSchema,
  vram: fieldValueSchema,
  motherboard: fieldValueSchema,
  ram: fieldValueSchema,
  ramSpeed: fieldValueSchema,
  ssd: fieldValueSchema,
  psu: fieldValueSchema,
  cooler: fieldValueSchema,
  case: fieldValueSchema,
})

const portableImageSchema = z.object({
  id,
  name: shortText,
  type: shortText,
  size: z.number().finite().nonnegative(),
  original: z.string().startsWith('data:image/'),
  compressedDataUrl: z.string().startsWith('data:image/'),
  createdAt: dateString,
})

const pricePointSchema = z.object({ id, price: amount, recordedAt: dateString })
const snapshotSchema = z.object({
  id,
  price: amount,
  components: componentsSchema,
  imageIds: z.array(id).max(100),
  url: z.string().max(4_000),
  createdAt: dateString,
})

const buildSchema = z.object({
  id,
  title: shortText,
  platform: z.enum(['京东', '淘宝', '天猫', '抖音', '其他']),
  store: shortText,
  url: z.string().max(4_000),
  price: amount,
  status: z.enum(['pending', 'watching', 'candidate', 'priority', 'rejected', 'purchased']),
  favorite: z.boolean(),
  tags: z.array(shortText).max(100),
  completeness: z.number().finite().min(0).max(100),
  components: componentsSchema,
  images: z.array(portableImageSchema).max(100),
  priceHistory: z.array(pricePointSchema).max(10_000),
  snapshots: z.array(snapshotSchema).max(2_000),
  analysis: z.object({
    summary: longText,
    advantages: z.array(longText).max(100),
    risks: z.array(longText).max(100),
    unknowns: z.array(longText).max(100),
    upgradeConsiderations: z.array(longText).max(100),
    confidence: z.number().finite().min(0).max(1),
    generatedAt: dateString,
  }).optional(),
  checklist: z.array(z.object({ id, label: shortText, done: z.boolean() })).max(200),
  note: longText,
  createdAt: dateString,
  updatedAt: dateString,
})

export const backupV1Schema = z.object({
  version: z.literal(1),
  exportedAt: dateString.optional(),
  data: z.object({
    settings: z.array(z.object({
      id: z.literal('primary'),
      appName: shortText,
      aiProvider: shortText,
      apiBaseUrl: z.string().max(4_000),
      apiKey: z.string().max(10_000),
      model: shortText,
      visionModel: shortText,
      theme: z.enum(['light', 'dark', 'system']),
      hasSeenWelcome: z.boolean(),
    })).max(1).optional(),
    financePlans: z.array(z.object({
      id: z.literal('primary'),
      currentBalance: amount,
      monthlyIncome: amount,
      monthlyFixedExpense: amount,
      monthlySaving: amount,
      extraIncome: amount,
      extraIncomeDate: z.string().max(64).optional(),
      housingFund: amount,
      targetBudget: amount,
      targetDate: dateString,
      updatedAt: dateString,
    })).max(1).optional(),
    countdowns: z.array(z.object({
      id,
      name: shortText,
      targetDate: dateString,
      targetTime: z.string().max(20),
      note: longText,
      pinned: z.boolean(),
      showOnHome: z.boolean(),
    })).max(2_000).optional(),
    goals: z.array(z.object({
      id,
      name: shortText,
      category: z.enum(['电脑', '手机', '显示器', '其他']),
      budget: amount,
      targetDate: dateString,
      active: z.boolean(),
    })).max(2_000).optional(),
    builds: z.array(buildSchema).max(2_000).optional(),
  }),
})

export function parseBackupV1(raw: string) {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('备份文件不是有效的 JSON')
  }
  const result = backupV1Schema.safeParse(json)
  if (!result.success) throw new Error('备份文件损坏、版本不支持或字段不完整')
  return result.data
}
