import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  size?: 'normal' | 'wide'
}

export function Modal({ open, title, description, children, onClose, size = 'normal' }: ModalProps) {
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    const focusTimer = window.requestAnimationFrame(() => {
      const autofocus = panelRef.current?.querySelector<HTMLElement>('[autofocus]')
      const firstControl = panelRef.current?.querySelector<HTMLElement>('button, input, select, textarea, a[href]')
      ;(autofocus ?? firstControl ?? panelRef.current)?.focus()
    })
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className={`modal-panel ${size === 'wide' ? 'modal-panel--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">工作台</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
