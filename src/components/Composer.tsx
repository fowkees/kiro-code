import {
  ChangeEvent,
  KeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { Attachment, ModelInfo } from '../types'
import { getFileCategory, isPlainTextFile } from '../lib/fileTypes'
import { ArrowUpIcon, ChevronDownIcon, FileIcon, InfoIcon, PaperclipIcon, StopIcon, XIcon } from './icons'

function shortCwd(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  return '/' + parts.slice(-2).map((p) => p.toLowerCase()).join('/')
}

const AUTO_DESCRIPTION = 'O Kiro escolhe automaticamente o modelo mais adequado para cada tarefa, buscando o melhor equilíbrio entre qualidade e velocidade.'

function ModelSelector({
  models,
  currentModelId,
  onSelect
}: {
  models: ModelInfo[]
  currentModelId: string | null
  onSelect: (modelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hoverInfo, setHoverInfo] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHoverInfo(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (models.length === 0) return null

  const current = models.find((m) => m.modelId === currentModelId)
  const label = current?.name ?? currentModelId ?? 'auto'

  return (
    <div className="model-selector" ref={wrapRef}>
      <button
        type="button"
        className="composer__model-pill composer__model-pill--button"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDownIcon width={12} height={12} />
      </button>
      {open && (
        <div className="model-selector__menu">
          {models.map((m) => (
            <div
              key={m.modelId}
              className={`model-selector__item ${m.modelId === currentModelId ? 'model-selector__item--active' : ''}`}
              onClick={() => {
                onSelect(m.modelId)
                setOpen(false)
                setHoverInfo(null)
              }}
            >
              <span className="model-selector__name">{m.name}</span>
              <span
                className="model-selector__info"
                onMouseEnter={(e) => {
                  setHoverInfo(m.modelId)
                  setHoverPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoverInfo(null)}
                onClick={(e) => e.stopPropagation()}
              >
                <InfoIcon width={12} height={12} />
              </span>
            </div>
          ))}
        </div>
      )}
      {hoverInfo && hoverPos && (
        <div className="model-selector__desc-float" style={{ left: hoverPos.x + 14, top: hoverPos.y }}>
          {hoverInfo === 'auto'
            ? AUTO_DESCRIPTION
            : (models.find((m) => m.modelId === hoverInfo)?.description ?? 'Sem descrição disponível.')}
        </div>
      )}
    </div>
  )
}

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
  const filePath = (file as unknown as { path?: string }).path

  if (file.type.startsWith('image/')) {
    const dataUrl = await readAsDataUrl(file)
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
    return { id: nextAttId(), name: file.name, kind: 'image', mimeType: file.type || 'image/png', data, filePath }
  }

  const category = getFileCategory(file.name)

  if (category === 'pdf' && filePath) {
    const text = await window.kiro.extractPdfText(filePath)
    return { id: nextAttId(), name: file.name, kind: 'text', text, fileCategory: 'pdf', filePath }
  }

  if (isPlainTextFile(file.name)) {
    const text = await readAsText(file)
    return { id: nextAttId(), name: file.name, kind: 'text', text, fileCategory: category, filePath }
  }

  return {
    id: nextAttId(),
    name: file.name,
    kind: 'text',
    text: `(arquivo "${file.name}" anexado, mas o conteúdo não pôde ser lido automaticamente)`,
    fileCategory: category,
    filePath
  }
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
    cwd: string | null
    models: ModelInfo[]
    currentModelId: string | null
    contextUsage: number | null
    creditsUsed: number
    creditsUnit: string
    onSend: (text: string, attachments: Attachment[]) => void
    onCancel: () => void
    onPreviewImage: (src: string) => void
    onSelectModel: (modelId: string) => void
  }
>(function Composer(
  {
    disabled,
    busy,
    connected,
    cwd,
    models,
    currentModelId,
    contextUsage,
    creditsUsed,
    creditsUnit,
    onSend,
    onCancel,
    onPreviewImage,
    onSelectModel
  },
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
                  <>
                    <FileIcon
                      width={14}
                      height={14}
                      className={`attachment-chip__icon attachment-chip__icon--${a.fileCategory ?? 'generic'}`}
                    />
                    <span className="attachment-chip__name">{a.name}</span>
                  </>
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
        <ModelSelector models={models} currentModelId={currentModelId} onSelect={onSelectModel} />
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
        {connected && cwd && (
          <span className="composer__cwd-path" title={cwd}>
            {shortCwd(cwd)}
          </span>
        )}
        <span className={`composer__status ${connected ? 'composer__status--on' : 'composer__status--off'}`}>
          <span className="composer__status-dot" />
          {connected ? 'conectado' : 'desconectado'}
        </span>
      </div>
    </div>
  )
})

export default Composer
