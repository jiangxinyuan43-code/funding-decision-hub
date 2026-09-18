import type { PricePoint } from '../../types/models'
import { currency, shortDate } from '../../utils/format'

export function PriceTrend({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return <p className="empty-inline">记录第二次价格后会显示趋势。</p>
  const width = 420
  const height = 128
  const padding = 16
  const values = points.map((point) => point.price)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const coords = points.map((point, index) => ({
    x: padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2),
    y: padding + ((max - point.price) / range) * (height - padding * 2),
  }))
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const latest = points[points.length - 1]!
  const delta = latest.price - points[0].price

  return (
    <div className="price-trend">
      <div className="price-trend__meta">
        <span>{points.length} 次记录</span>
        <strong className={delta <= 0 ? 'text-positive' : 'text-risk'}>{delta === 0 ? '价格持平' : `${delta < 0 ? '下降' : '上涨'} ${currency.format(Math.abs(delta))}`}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="价格趋势图">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
        <polyline points={line} className="chart-line" />
        {coords.map((point, index) => <circle key={points[index].id} cx={point.x} cy={point.y} r="4" className="chart-dot" />)}
      </svg>
      <div className="price-trend__labels">
        <span>{shortDate.format(new Date(points[0].recordedAt))}</span>
        <span>{currency.format(latest.price)}</span>
        <span>{shortDate.format(new Date(latest.recordedAt))}</span>
      </div>
    </div>
  )
}
