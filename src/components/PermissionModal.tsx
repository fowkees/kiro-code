import { PermissionRequest } from '../types'

export default function PermissionModal({
  request,
  onChoose
}: {
  request: PermissionRequest
  onChoose: (optionId: string) => void
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Permissão necessária</h3>
        <p>{request.title}</p>
        <div className="modal__actions">
          {request.options.map((opt) => (
            <button
              key={opt.optionId}
              className={`btn ${opt.kind === 'allow_always' || opt.kind === 'allow_once' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => onChoose(opt.optionId)}
            >
              {opt.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
