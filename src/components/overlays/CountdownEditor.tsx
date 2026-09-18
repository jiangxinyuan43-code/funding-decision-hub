import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { db } from '../../services/storage/db'
import type { Countdown } from '../../types/models'
import { createId } from '../../utils/ids'

interface Props { open: boolean; onClose: () => void; notify: (message: string, tone?: 'success' | 'error') => void }

const emptyCountdown = (): Countdown => ({ id: createId('countdown'), name: '', targetDate: '2026-11-11', targetTime: '00:00', note: '', pinned: false, showOnHome: true })

export function CountdownEditor({ open, onClose, notify }: Props) {
  const [draft, setDraft] = useState(emptyCountdown)
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const countdowns = useLiveQuery(() => db.countdowns.orderBy('targetDate').toArray(), []) ?? []
  useEffect(() => {
    if (open) {
      setDraft(emptyCountdown())
      setIsEditing(false)
      setConfirmingDelete(null)
    }
  }, [open])
  const set = <K extends keyof Countdown>(key: K, value: Countdown[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const startNew = () => { setDraft(emptyCountdown()); setIsEditing(false); setConfirmingDelete(null) }
  const edit = (countdown: Countdown) => { setDraft(structuredClone(countdown)); setIsEditing(true); setConfirmingDelete(null) }
  const save = async () => {
    if (!draft.name.trim() || !draft.targetDate) return notify('请填写倒数日名称和日期', 'error')
    await db.countdowns.put({ ...draft, name: draft.name.trim(), note: draft.note.trim() })
    notify(isEditing ? '倒数日已更新' : '倒数日已添加')
    startNew()
  }
  const remove = async (id: string) => {
    await db.countdowns.delete(id)
    if (draft.id === id) startNew()
    setConfirmingDelete(null)
    notify('倒数日已删除')
  }
  return (
    <Modal open={open} onClose={onClose} title="管理倒数日" description="新增、修改或删除节点；首页展示最靠前的三个。" size="wide">
      <div className="editor-mode-heading">
        <div><p className="eyebrow">{isEditing ? '编辑节点' : '新节点'}</p><strong>{isEditing ? draft.name || '未命名倒数日' : '添加一个时间节点'}</strong></div>
        {isEditing && <button className="secondary-button" type="button" onClick={startNew}><Plus size={17} /> 新建</button>}
      </div>
      <div className="form-stack">
        <label><span>名称</span><input autoFocus value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="例如：双十一" /></label>
        <div className="form-grid"><label><span>目标日期</span><input type="date" value={draft.targetDate} onChange={(event) => set('targetDate', event.target.value)} /></label><label><span>目标时间</span><input type="time" value={draft.targetTime} onChange={(event) => set('targetTime', event.target.value)} /></label></div>
        <label><span>备注</span><textarea value={draft.note} onChange={(event) => set('note', event.target.value)} placeholder="到这个节点需要完成什么" rows={3} /></label>
        <div className="toggle-list"><label><span><strong>置顶</strong><small>优先显示在倒数日列表</small></span><input type="checkbox" checked={draft.pinned} onChange={(event) => set('pinned', event.target.checked)} /></label><label><span><strong>显示在首页</strong><small>首页最多展示三个</small></span><input type="checkbox" checked={draft.showOnHome} onChange={(event) => set('showOnHome', event.target.checked)} /></label></div>
      </div>

      <div className="editor-divider" />
      <div className="section-heading"><div><p className="eyebrow">已保存</p><h3>全部倒数日</h3></div><span>{countdowns.length} 个</span></div>
      <div className="managed-list">
        {countdowns.map((countdown) => (
          <div className={draft.id === countdown.id && isEditing ? 'managed-row is-active' : 'managed-row'} key={countdown.id}>
            <button className="managed-row__main" type="button" onClick={() => edit(countdown)}>
              <span><strong>{countdown.name}</strong><small>{countdown.targetDate} · {countdown.targetTime}{countdown.showOnHome ? ' · 首页显示' : ''}</small></span>
              <Pencil size={17} />
            </button>
            {confirmingDelete === countdown.id ? (
              <div className="managed-row__confirm" role="alert"><span>确定删除？</span><button type="button" onClick={() => setConfirmingDelete(null)}>取消</button><button type="button" onClick={() => remove(countdown.id)}>删除</button></div>
            ) : (
              <button className="managed-row__delete" type="button" onClick={() => setConfirmingDelete(countdown.id)} aria-label={`删除 ${countdown.name}`} title="删除"><Trash2 size={17} /></button>
            )}
          </div>
        ))}
        {!countdowns.length && <div className="empty-inline"><CalendarPlus size={18} /><span>还没有倒数日，填写上方内容即可添加。</span></div>}
      </div>

      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>完成</button><button className="primary-button" type="button" onClick={save}><CalendarPlus size={18} /> {isEditing ? '保存修改' : '添加节点'}</button></div>
    </Modal>
  )
}
