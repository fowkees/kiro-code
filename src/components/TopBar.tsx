import { GlobeIcon } from './icons'

export default function TopBar({
  title,
  folderLabel,
  updateVersion,
  browserOpen,
  onToggleBrowser,
  onOpenUpdate
}: {
  title: string
  folderLabel: string | null
  updateVersion: string | null
  browserOpen: boolean
  onToggleBrowser: () => void
  onOpenUpdate: () => void
}) {
  return (
    <div className={`topbar ${browserOpen ? 'topbar--browser-open' : ''}`}>
      <div className="topbar__title">{title}</div>
      {folderLabel && <div className="topbar__pill">{folderLabel}</div>}
      <div className="topbar__spacer" />
      <button
        className={`topbar__browser-toggle ${browserOpen ? 'topbar__browser-toggle--active' : ''}`}
        onClick={onToggleBrowser}
        title="Navegador do Kiro"
      >
        <GlobeIcon width={15} height={15} />
      </button>
      {updateVersion && (
        <button className="topbar__update" onClick={onOpenUpdate} title={`Versão ${updateVersion} pronta`}>
          <span className="topbar__update-dot" />
          Atualização disponível
        </button>
      )}
    </div>
  )
}
