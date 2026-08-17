import { useEffect, useRef } from 'react'
import { FolderIcon, PencilIcon, PinIcon, TrashIcon } from './icons'

export default function SessionMenu({
  x,
  y,
  pinned,
  onRename,
  onTogglePin,
  onOpenInExplorer,
  onDelete,
  onClose
}: {
  x: number
  y: number
  pinned: boolean
  onRename: () => void
  onTogglePin: () => void
  onOpenInExplorer: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  function run(fn: () => void) {
    fn()
    onClose()
  }

  return (
    <div className="session-menu" style={{ left: x, top: y }} ref={ref}>
      <button className="session-menu__item" onClick={() => run(onOpenInExplorer)}>
        <FolderIcon className="session-menu__icon" width={15} height={15} />
        Abrir pasta no Explorador
      </button>
      <button className="session-menu__item" onClick={() => run(onTogglePin)}>
        <PinIcon className="session-menu__icon" width={15} height={15} />
        {pinned ? 'Desafixar' : 'Fixar'}
      </button>
      <button className="session-menu__item" onClick={() => run(onRename)}>
        <PencilIcon className="session-menu__icon" width={15} height={15} />
        Mudar o nome
        <span className="session-menu__shortcut">R</span>
      </button>
      <div className="session-menu__separator" />
      <button className="session-menu__item session-menu__item--danger" onClick={() => run(onDelete)}>
        <TrashIcon className="session-menu__icon" width={15} height={15} />
        Apagar
        <span className="session-menu__shortcut">D</span>
      </button>
    </div>
  )
}
