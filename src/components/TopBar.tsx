export default function TopBar({
  title,
  folderLabel,
  updateVersion,
  onOpenUpdate
}: {
  title: string
  folderLabel: string | null
  updateVersion: string | null
  onOpenUpdate: () => void
}) {
  return (
    <div className="topbar">
      <div className="topbar__title">{title}</div>
      {folderLabel && <div className="topbar__pill">{folderLabel}</div>}
      <div className="topbar__spacer" />
      {updateVersion && (
        <button className="topbar__update" onClick={onOpenUpdate} title={`Versão ${updateVersion} pronta`}>
          <span className="topbar__update-dot" />
          Atualização disponível
        </button>
      )}
    </div>
  )
}
