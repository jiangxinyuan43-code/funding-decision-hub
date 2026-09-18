import { useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { db } from '../../services/storage/db'
import type { Countdown } from '../../types/models'
import { createId } from '../../utils/ids'

interface Props { open: boolean; onClose: () => void; notify: (message: string, tone?: 'success' | 'error') => void }

const emptyCountdown = (): Countdown => ({ id: createId('countdown'), name: '', targetDate: '2026-11-11', targetTime: '00:00', note: '', pinned: false, showOnHome: true })

export function CountdownEditor({ open, onClose, notify }: Props) {
  const [draft, setDraft] = useState(emptyCountdown)
  useEffect(() => { if (open) setDraft(emptyCountdown()) }, [open])
  const set = <K extends keyof Countdown>(key: K, value: Countdown[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const save = async () => {
    if (!draft.name.trim() || !draft.targetDate) return notify('请填写倒数日名称和日期', 'error')
    await db.countdowns.put({ ...draft, name: draft.name.trim(), note: draft.note.trim() })
    notify('倒数日已添加')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="添加倒数日" description="首页最多展示三个开启显示的节点。">
      <div className="form-stack">
        <label><span>名称</span><input autoFocus value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="例如：双十一" /></label>
        <div className="form-grid"><label><span>目标日期</span><input type="date" value={draft.targetDate} onChange={(event) => set('targetDate', event.target.value)} /></label><label><span>目标时间</span><input type="time" value={draft.targetTime} onChange={(event) => set('targetTime', event.target.value)} /></label></div>
        <label><span>备注</span><textarea value={draft.note} onChange={(event) => set('note', event.target.value)} placeholder="到这个节点需要完成什么" rows={3} /></label>
        <div className="toggle-list"><label><span><strong>置顶</strong><small>优先显示在倒数日列表</small></span><input type="checkbox" checked={draft.pinned} onChange={(event) => set('pinned', event.target.checked)} /></label><label><span><strong>显示在首页</strong><small>首页最多展示三个</small></span><input type="checkbox" checked={draft.showOnHome} onChange={(event) => set('showOnHome', event.target.checked)} /></label></div>
      </div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={save}><CalendarPlus size={18} /> 添加节点</button></div>
    </Modal>
  )
}
