import { useState } from 'react'
import { FeedbackSparkleIcon, XIcon } from './icons'

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit() {
    const text = message.trim()
    if (!text || status === 'sending') return
    setStatus('sending')
    const result = await window.kiro.sendFeedback(text)
    setStatus(result.ok ? 'sent' : 'error')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-modal__close feedback-modal__close" onClick={onClose} title="Fechar">
          <XIcon width={16} height={16} />
        </button>

        {status === 'sent' ? (
          <div className="feedback-modal__done">
            <FeedbackSparkleIcon width={32} height={32} />
            <h2>Valeu!</h2>
            <p>Seu feedback foi enviado. Obrigado por ajudar a melhorar o Kiro Code.</p>
            <button className="btn btn--primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="feedback-modal__header">
              <FeedbackSparkleIcon width={22} height={22} />
              <h2>Sugerir uma melhoria</h2>
            </div>
            <p className="settings-hint">
              Conta o que você gostaria de ver no Kiro Code — uma função nova, um ajuste, o que for. Sua mensagem
              chega direto pra quem mantém o app.
            </p>
            <textarea
              className="feedback-modal__textarea"
              placeholder="Ex: queria poder..."
              value={message}
              autoFocus
              onChange={(e) => setMessage(e.target.value)}
            />
            {status === 'error' && (
              <p className="feedback-modal__error">Não consegui enviar agora. Tenta de novo em instantes.</p>
            )}
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={onClose}>
                Cancelar
              </button>
              <button className="btn btn--primary" disabled={!message.trim() || status === 'sending'} onClick={submit}>
                {status === 'sending' ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
