interface ProgressProps {
  value: number
  label?: string
  tone?: 'green' | 'blue' | 'amber'
}

export function Progress({ value, label, tone = 'green' }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className="progress-wrap">
      {label && (
        <div className="progress-meta">
          <span>{label}</span>
          <strong>{Math.round(safeValue)}%</strong>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100}>
        <span className={`progress-fill progress-fill--${tone}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}
