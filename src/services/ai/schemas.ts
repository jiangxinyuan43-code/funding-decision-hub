import { z } from 'zod'

const fieldSchema = z.object({
  value: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0),
})

export const extractionSchema = z.object({
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

export type ExtractionResult = z.infer<typeof extractionSchema>

export const comparisonSchema = z.object({
  coreDifferences: z.array(z.string()).default([]),
  risks: z.record(z.array(z.string())).default({}),
  priceNotes: z.array(z.string()).default([]),
  usageNotes: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
})

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
        ['cpu', 'gpu', 'vram', 'motherboard', 'ram', 'ramSpeed', 'ssd', 'psu', 'cooler', 'case'].map((key) => [
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
    risks: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
    priceNotes: { type: 'array', items: { type: 'string' } },
    usageNotes: { type: 'array', items: { type: 'string' } },
    unknowns: { type: 'array', items: { type: 'string' } },
  },
  required: ['coreDifferences', 'risks', 'priceNotes', 'usageNotes', 'unknowns'],
} as const
