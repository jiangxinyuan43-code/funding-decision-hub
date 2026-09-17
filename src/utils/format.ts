export const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
})

export const shortDate = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
})

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof date === 'string' ? new Date(`${date}T00:00:00`) : date)
}

export function daysUntil(targetDate: string, now = new Date()) {
  const target = new Date(`${targetDate}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export function dateLabel(days: number) {
  if (days === 0) return '就是今天'
  if (days === 1) return '还有 1 天'
  if (days > 1) return `还有 ${days} 天`
  return `已过 ${Math.abs(days)} 天`
}
