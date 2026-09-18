export function normalizeHttpUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('商品链接格式不正确')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('商品链接仅支持 HTTP 或 HTTPS')
  return parsed.href
}
