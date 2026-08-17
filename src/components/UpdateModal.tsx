export default function UpdateModal({
  version,
  notes,
  onRestart,
  onLater
}: {
  version: string
  notes: string[]
  onRestart: () => void
  onLater: () => void
}) {
  return (
    <div className="modal-overlay">
      <div className="modal modal--large">
        <div className="update-modal__badge">Nova versão: {version}</div>
        <h2 className="update-modal__title">Atualizar para a versão mais recente?</h2>
        <p className="update-modal__subtitle">O que mudou:</p>
        {notes.length > 0 ? (
          <ul className="update-modal__list">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className="update-modal__empty">Melhorias e correções internas.</p>
        )}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onLater}>
            Não
          </button>
          <button className="btn btn--primary" onClick={onRestart}>
            Sim, atualizar
          </button>
        </div>
      </div>
    </div>
  )
}
