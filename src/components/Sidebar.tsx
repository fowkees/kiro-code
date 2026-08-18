import { KeyboardEvent, RefObject, useEffect, useState } from 'react'
import { SessionSummary } from '../types'
import { dayGroup } from '../lib/time'
import { getPinned, togglePinned } from '../lib/pinned'
import SessionMenu from './SessionMenu'
import ConfirmDialog from './ConfirmDialog'
import {
  CircleIcon,
  FeedbackSparkleIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PinIcon,
  PlusIcon,
  SettingsIcon
} from './icons'

interface MenuState {
  sessionId: string
  x: number
  y: number
}

export default function Sidebar({
  sessions,
  activeSessionId,
  width,
  collapsed,
  panelRef,
  onToggleCollapsed,
  onNewChat,
  onOpenSession,
  onOpenFolder,
  onRenameSession,
  onDeleteSession,
  onOpenInExplorer,
  onOpenSettings,
  onOpenFeedback
}: {
  sessions: SessionSummary[]
  activeSessionId: string | null
  width: number
  collapsed: boolean
  panelRef: RefObject<HTMLElement>
  onToggleCollapsed: () => void
  onNewChat: () => void
  onOpenSession: (session: SessionSummary) => void
  onOpenFolder: () => void
  onRenameSession: (sessionId: string, title: string) => void
  onDeleteSession: (sessionId: string) => void
  onOpenInExplorer: (cwd: string) => void
  onOpenSettings: () => void
  onOpenFeedback: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null)
  const [pinned, setPinned] = useState<Set<string>>(() => getPinned())

  useEffect(() => {
    setPinned(getPinned())
  }, [sessions])

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed" ref={panelRef}>
        <button className="sidebar__rail-btn" title="Expandir barra lateral" onClick={onToggleCollapsed}>
          <PanelLeftIcon width={17} height={17} />
        </button>
        <span className="sidebar__rail-icon">K</span>
        <button className="sidebar__rail-btn" title="Nova conversa" onClick={onNewChat}>
          <PlusIcon width={17} height={17} />
        </button>
        <button className="sidebar__rail-btn" title="Abrir pasta…" onClick={onOpenFolder}>
          <FolderIcon width={17} height={17} />
        </button>
        <div className="sidebar__rail-spacer" />
        <button className="sidebar__rail-btn" title="Sugerir uma melhoria" onClick={onOpenFeedback}>
          <FeedbackSparkleIcon width={15} height={15} />
        </button>
        <button className="sidebar__rail-btn" title="Configurações" onClick={onOpenSettings}>
          <SettingsIcon width={16} height={16} />
        </button>
      </aside>
    )
  }

  const pinnedSessions = sessions.filter((s) => pinned.has(s.sessionId))
  const restSessions = sessions.filter((s) => !pinned.has(s.sessionId))

  const groups = new Map<string, SessionSummary[]>()
  for (const s of restSessions) {
    const g = dayGroup(s.updatedAt)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(s)
  }

  function startEditing(s: SessionSummary) {
    setEditingId(s.sessionId)
    setEditValue(s.title)
  }

  function commitEdit() {
    if (editingId) {
      const title = editValue.trim()
      if (title) onRenameSession(editingId, title)
    }
    setEditingId(null)
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  function handleTogglePin(sessionId: string) {
    setPinned(togglePinned(sessionId))
  }

  function handleDelete(s: SessionSummary) {
    setDeleteTarget(s)
  }

  function confirmDelete() {
    if (deleteTarget) onDeleteSession(deleteTarget.sessionId)
    setDeleteTarget(null)
  }

  function renderItem(s: SessionSummary) {
    return (
      <div
        key={s.sessionId}
        className={`sidebar__item ${s.sessionId === activeSessionId ? 'sidebar__item--active' : ''}`}
        onClick={() => editingId !== s.sessionId && onOpenSession(s)}
        title={`${s.cwd}`}
      >
        <CircleIcon className="sidebar__item-dot" width={7} height={7} />
        {editingId === s.sessionId ? (
          <input
            className="sidebar__item-input"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="sidebar__item-title">
            {pinned.has(s.sessionId) && <PinIcon className="sidebar__pin-mark" width={10} height={10} />}
            {s.title}
          </span>
        )}
        <div className="sidebar__item-actions">
          <button
            className="sidebar__item-action"
            title="Mais opções"
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setMenu({ sessionId: s.sessionId, x: rect.left - 160, y: rect.bottom + 4 })
            }}
          >
            <MoreHorizontalIcon width={19} height={19} />
          </button>
        </div>
      </div>
    )
  }

  const activeMenuSession = sessions.find((s) => s.sessionId === menu?.sessionId)

  return (
    <aside className="sidebar" style={{ width }} ref={panelRef}>
      <div className="sidebar__toprow">
        <button className="sidebar__rail-btn" title="Recolher barra lateral" onClick={onToggleCollapsed}>
          <PanelLeftIcon width={16} height={16} />
        </button>
      </div>

      <div className="sidebar__brand">
        <span className="sidebar__brand-text">Kiro Code</span>
      </div>

      <nav className="sidebar__nav">
        <button className="sidebar__nav-item" onClick={onNewChat}>
          <PlusIcon className="sidebar__nav-icon" width={15} height={15} /> Nova conversa
        </button>
        <button className="sidebar__nav-item" onClick={onOpenFolder}>
          <FolderIcon className="sidebar__nav-icon" width={15} height={15} /> Abrir pasta…
        </button>
      </nav>

      <div className="sidebar__history">
        {sessions.length === 0 && <div className="sidebar__empty">Nenhuma conversa ainda</div>}

        {pinnedSessions.length > 0 && (
          <div className="sidebar__group">
            <div className="sidebar__group-label">Fixadas</div>
            {pinnedSessions.map(renderItem)}
          </div>
        )}

        {[...groups.entries()].map(([group, items]) => (
          <div key={group} className="sidebar__group">
            <div className="sidebar__group-label">{group}</div>
            {items.map(renderItem)}
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        <button className="sidebar__footer-btn" title="Sugerir uma melhoria" onClick={onOpenFeedback}>
          <FeedbackSparkleIcon width={14} height={14} />
        </button>
        <button className="sidebar__footer-btn" title="Configurações" onClick={onOpenSettings}>
          <SettingsIcon width={15} height={15} />
        </button>
      </div>

      {menu && activeMenuSession && (
        <SessionMenu
          x={menu.x}
          y={menu.y}
          pinned={pinned.has(menu.sessionId)}
          onRename={() => startEditing(activeMenuSession)}
          onTogglePin={() => handleTogglePin(menu.sessionId)}
          onOpenInExplorer={() => onOpenInExplorer(activeMenuSession.cwd)}
          onDelete={() => handleDelete(activeMenuSession)}
          onClose={() => setMenu(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Excluir conversa"
          message={`Excluir a conversa "${deleteTarget.title}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </aside>
  )
}
