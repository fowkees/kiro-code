import { ChangeEvent, KeyboardEvent, forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Attachment } from '../types'
import { ArrowUpIcon, PaperclipIcon, StopIcon, XIcon } from './icons'

let attId = 0
const nextAttId = () => `att${++attId}`

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith('image/')) {
    const dataUrl = await readAsDataUrl(file)
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
    return { id: nextAttId(), name: file.name, kind: 'image', mimeType: file.type || 'image/png', data }
  }
  const text = await readAsText(file)
  return { id: nextAttId(), name: file.name, kind: 'text', text }
}

export interface ComposerHandle {
  addFiles: (files: FileList | File[]) => void
}

const Composer = forwardRef<
  ComposerHandle,
  {
    disabled: boolean
    busy: boolean
    connected: boolean
    modelName: string | null
    contextUsage: number | null
    creditsUsed: number
    creditsUnit: string
    onSend: (text: string, attachments: Attachment[]) => void
    onCancel: () => void
    onPreviewImage: (src: string) => void
  }
>(function Composer(
  { disabled, busy, connected, modelName, contextUsage, creditsUsed, creditsUnit, onSend, onCancel, onPreviewImage },
  ref
) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files)
    const results = await Promise.all(list.map(fileToAttachment))
    setAttachments((prev) => [...prev, ...results])
  }

  useImperativeHandle(ref, () => ({ addFiles }))

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  function submit() {
    const text = value.trim()
    if ((!text && attachments.length === 0) || disabled || busy) return
    onSend(text, attachments)
    setValue('')
    setAttachments([])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="composer">
      <div className="composer__box">
        {attachments.length > 0 && (
          <div className="composer__attachments">
            {attachments.map((a) => (
              <div key={a.id} className={`attachment-chip ${a.kind === 'image' ? 'attachment-chip--image' : ''}`}>
                {a.kind === 'image' ? (
                  <img
                    src={`data:${a.mimeType};base64,${a.data}`}
                    alt={a.name}
                    title={a.name}
                    className="attachment-chip__thumb"
                    onClick={() => onPreviewImage(`data:${a.mimeType};base64,${a.data}`)}
                  />
                ) : (
                  <span className="attachment-chip__name">{a.name}</span>
                )}
                <button className="attachment-chip__remove" onClick={() => removeAttachment(a.id)} title="Remover">
                  <XIcon width={11} height={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="composer__row">
          <button
            className="composer__attach"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
          >
            <PaperclipIcon width={17} height={17} />
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInput} />
          <textarea
            ref={textareaRef}
            className="composer__input"
            placeholder={disabled ? 'Abra uma pasta para começar' : 'Converse com o Kiro…'}
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {busy ? (
            <button className="composer__send composer__send--stop" onClick={onCancel} title="Interromper">
              <StopIcon width={13} height={13} />
            </button>
          ) : (
            <button
              className="composer__send"
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              onClick={submit}
              title="Enviar"
            >
              <ArrowUpIcon width={16} height={16} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>
      <div className="composer__toolbar">
        {modelName && <span className="composer__model-pill">{modelName}</span>}
        {creditsUsed > 0 && (
          <span className="composer__model-pill" title="Créditos consumidos nesta conversa">
            {creditsUsed.toFixed(2)} {creditsUnit}
          </span>
        )}
        {contextUsage !== null && (
          <span className="composer__model-pill" title="Uso da janela de contexto">
            {contextUsage.toFixed(1)}% contexto
          </span>
        )}
        <div className="composer__spacer" />
        <span className={`composer__status ${connected ? 'composer__status--on' : 'composer__status--off'}`}>
          <span className="composer__status-dot" />
          {connected ? 'conectado' : 'desconectado'}
        </span>
      </div>
    </div>
  )
})

export default Composer
