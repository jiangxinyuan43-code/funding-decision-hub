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
  testConnection(): Promise<void>
  testVision(): Promise<void>
}

type JsonSchema = Record<string, unknown>

export class OpenAICompatibleProvider implements AIProvider {
  private readonly baseUrl: string

  constructor(private readonly settings: UserSettings) {
    this.baseUrl = settings.apiBaseUrl.replace(/\/$/, '')
  }

  private parseJson(raw: string) {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    try {
      return JSON.parse(cleaned) as unknown
    } catch {
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try { return JSON.parse(cleaned.slice(start, end + 1)) as unknown } catch { /* handled below */ }
      }
      throw new Error('AI 返回的内容不是有效 JSON，请重试或更换模型')
    }
  }

  private async send(payload: Record<string, unknown>) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 90_000)
    try {
      return await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('AI 请求超时，请稍后重试')
      throw new Error('无法连接 AI 服务，请检查 Base URL、网络或浏览器 CORS 设置')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  private async responseError(response: Response, model: string) {
    let detail = ''
    try {
      const body = await response.clone().json() as { error?: { message?: string } }
      detail = body.error?.message?.toLowerCase() ?? ''
    } catch { /* response body is optional */ }
    if (response.status === 401) return new Error('API Key 无效或无权限')
    if (response.status === 429) return new Error('AI 服务请求过多或余额不足，请稍后重试')
    if (/image|vision|multimodal/.test(detail)) return new Error(`视觉模型 ${model} 不支持当前图片输入，请检查模型能力`)
    if (/model/.test(detail)) return new Error(`模型 ${model} 不可用，请检查模型名称或账号权限`)
    return new Error(`AI 服务返回异常（${response.status}）`)
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

    let response = await this.send(payload)

    if (!response.ok && [400, 404, 422].includes(response.status)) {
      response = await this.send({ ...payload, response_format: { type: 'json_object' } })
    }

    if (!response.ok) throw await this.responseError(response, model)
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> }
    const content = body.choices?.[0]?.message?.content
    const raw = Array.isArray(content) ? content.map((part) => part.text ?? '').join('') : content
    if (!raw) throw new Error('AI 未返回可解析的内容')
    return this.parseJson(raw)
  }

  async analyzeImages(images: string[], context = '') {
    if (!images.length) throw new Error('请先选择图片')
    const outputTemplate = '{"title":"","platform":"其他","store":"","price":0,"fields":{"cpu":{"value":"","confidence":0},"gpu":{"value":"","confidence":0},"vram":{"value":"","confidence":0},"motherboard":{"value":"","confidence":0},"ram":{"value":"","confidence":0},"ramSpeed":{"value":"","confidence":0},"ssd":{"value":"","confidence":0},"psu":{"value":"","confidence":0},"cooler":{"value":"","confidence":0},"case":{"value":"","confidence":0}},"advantages":[],"risks":[],"unknowns":[],"summary":""}'
    const content = [
      {
        type: 'text',
        text: `从整机商品截图提取配置，只输出一个 JSON 对象，不要 Markdown。必须保留下面模板中的全部键，字段名和嵌套层级不得改变：\n${outputTemplate}\n只记录图片中明确出现的信息，不猜测品牌或型号；不确定字段留空并降低 confidence。confidence 使用 0 到 1。区分 RTX 5060 Ti 的 8GB/16GB。电源和主板缺少具体型号时写“型号未明确”。${context ? `\n用户补充：${context}` : ''}`,
      },
      ...images.map((image) => ({ type: 'image_url', image_url: { url: image, detail: 'high' } })),
    ]
    const result = await this.request(
      this.settings.visionModel || this.settings.model,
      [{ role: 'user', content }],
      extractionJsonSchema as unknown as JsonSchema,
      'pc_build_extraction',
    )
    const parsed = extractionSchema.safeParse(result)
    if (!parsed.success) throw new Error('AI 返回的配置结构不完整，请重试或手动补充')
    const hasContent = parsed.data.title || parsed.data.store || parsed.data.price > 0 || Object.values(parsed.data.fields).some((item) => item.value)
    if (!hasContent) throw new Error('AI 未识别出配置字段，请换一张更清晰的截图')
    return parsed.data
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
          content: '你是购机决策支持助手。只比较给定事实，不替用户做最终购买决定，不补全未知硬件。只输出 JSON，必须包含 coreDifferences、risks、priceNotes、usageNotes、unknowns 五个键。',
        },
        { role: 'user', content: `比较以下 2-4 个方案：${JSON.stringify(compact)}` },
      ],
      comparisonJsonSchema as unknown as JsonSchema,
      'pc_build_comparison',
    )
    const parsed = comparisonSchema.safeParse(result)
    if (!parsed.success) throw new Error('AI 返回的对比结构不完整，请重试')
    return parsed.data
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
    return extractionSchema.parse(result)
  }

  async testConnection() {
    const result = await this.request(
      this.settings.model,
      [{ role: 'user', content: '请只输出 JSON：{"ok":true}' }],
      {
        type: 'object',
        additionalProperties: false,
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
      },
      'connection_test',
    )
    if ((result as { ok?: unknown }).ok !== true) throw new Error('AI 已响应，但没有按预期返回 JSON')
  }

  async testVision() {
    if (typeof document === 'undefined') throw new Error('图片能力测试只能在浏览器中运行')
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 640
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法生成测试图片')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#111111'
    context.font = '700 48px sans-serif'
    context.fillText('PC BUILD TEST', 72, 90)
    context.font = '36px sans-serif'
    ;[
      'CPU: AMD Ryzen 7 7800X3D',
      'GPU: NVIDIA GeForce RTX 5070',
      'RAM: 32GB DDR5',
      'SSD: 1TB NVMe',
      'PSU: 750W',
      'PRICE: 12999',
    ].forEach((line, index) => context.fillText(line, 72, 175 + index * 68))
    const result = await this.analyzeImages([canvas.toDataURL('image/png')], '这是图片识别链路测试，请按图片文字提取，不要猜测。')
    if (!result.fields.cpu.value || !result.fields.gpu.value) throw new Error('视觉模型可以接收图片，但未能提取测试配置')
  }
}

export function createAIProvider(settings: UserSettings): AIProvider {
  return new OpenAICompatibleProvider(settings)
}
