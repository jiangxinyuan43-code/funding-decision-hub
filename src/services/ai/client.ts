import type { ComparisonAnalysis, PCBuild, UserSettings } from '../../types/models'
import {
  comparisonJsonSchema,
  comparisonSchema,
  extractionJsonSchema,
  extractionSchema,
  type ExtractionResult,
} from './schemas'

export interface AIProvider {
  analyzeImages(images: string[], context?: string): Promise<ExtractionResult>
  compareBuilds(builds: PCBuild[]): Promise<ComparisonAnalysis>
  normalizeHardware(value: string, kind: 'cpu' | 'gpu'): Promise<string>
  extractProductInfo(text: string): Promise<Partial<ExtractionResult>>
}

type JsonSchema = Record<string, unknown>

export class OpenAICompatibleProvider implements AIProvider {
  private readonly baseUrl: string

  constructor(private readonly settings: UserSettings) {
    this.baseUrl = settings.apiBaseUrl.replace(/\/$/, '')
  }

  private async request(model: string, messages: unknown[], schema: JsonSchema, schemaName: string) {
    if (!this.settings.apiKey.trim()) throw new Error('请先在“我的”中填写 API Key')
    if (!this.baseUrl.startsWith('http')) throw new Error('API Base URL 格式不正确')

    const payload = {
      model,
      messages,
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    }

    let response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    })

    if (!response.ok && [400, 404, 422].includes(response.status)) {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
        body: JSON.stringify({ ...payload, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(90_000),
      })
    }

    if (!response.ok) {
      const safeMessage = response.status === 401 ? 'API Key 无效或无权限' : `AI 服务返回异常（${response.status}）`
      throw new Error(safeMessage)
    }
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> }
    const content = body.choices?.[0]?.message?.content
    const raw = Array.isArray(content) ? content.map((part) => part.text ?? '').join('') : content
    if (!raw) throw new Error('AI 未返回可解析的内容')
    return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as unknown
  }

  async analyzeImages(images: string[], context = '') {
    if (!images.length) throw new Error('请先选择图片')
    const content = [
      {
        type: 'text',
        text: `从整机商品截图提取配置并输出 JSON。只记录图片中明确出现的信息，不猜测品牌或型号；不确定字段留空并降低 confidence。区分 RTX 5060 Ti 的 8GB/16GB。电源和主板缺少具体型号时写“型号未明确”。${context ? `\n用户补充：${context}` : ''}`,
      },
      ...images.map((image) => ({ type: 'image_url', image_url: { url: image, detail: 'high' } })),
    ]
    const result = await this.request(
      this.settings.visionModel || this.settings.model,
      [{ role: 'user', content }],
      extractionJsonSchema as unknown as JsonSchema,
      'pc_build_extraction',
    )
    return extractionSchema.parse(result)
  }

  async compareBuilds(builds: PCBuild[]) {
    const compact = builds.map((build) => ({
      title: build.title,
      price: build.price,
      store: build.store,
      completeness: build.completeness,
      components: Object.fromEntries(Object.entries(build.components).map(([key, field]) => [key, field.value || '未明确'])),
    }))
    const result = await this.request(
      this.settings.model,
      [
        {
          role: 'system',
          content: '你是购机决策支持助手。只比较给定事实，不替用户做最终购买决定，不补全未知硬件。输出短句 JSON。',
        },
        { role: 'user', content: `比较以下 2-4 个方案：${JSON.stringify(compact)}` },
      ],
      comparisonJsonSchema as unknown as JsonSchema,
      'pc_build_comparison',
    )
    return comparisonSchema.parse(result)
  }

  async normalizeHardware(value: string, kind: 'cpu' | 'gpu') {
    const result = await this.request(
      this.settings.model,
      [{ role: 'user', content: `将以下${kind.toUpperCase()}名称标准化，不添加未知规格：${value}` }],
      {
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'string' } },
        required: ['value'],
      },
      'hardware_name',
    )
    return String((result as { value?: string }).value ?? value)
  }

  async extractProductInfo(text: string) {
    const result = await this.request(
      this.settings.model,
      [{ role: 'user', content: `从商品文本提取已明确的整机信息，不要猜测：${text}` }],
      extractionJsonSchema as unknown as JsonSchema,
      'pc_product_text',
    )
    return extractionSchema.partial().parse(result)
  }
}

export function createAIProvider(settings: UserSettings): AIProvider {
  return new OpenAICompatibleProvider(settings)
}
