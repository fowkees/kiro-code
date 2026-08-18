import { DragEvent, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TopBar from './components/TopBar'
import Composer, { ComposerHandle } from './components/Composer'
import ToolCallCard from './components/ToolCallCard'
import PermissionModal from './components/PermissionModal'
import Sidebar from './components/Sidebar'
import UpdateModal from './components/UpdateModal'
import ImageLightbox from './components/ImageLightbox'
import { FileIcon, PaperclipIcon } from './components/icons'
import { Attachment, Block, ModelInfo, PermissionRequest, SessionSummary } from './types'

function extractText(content: any): string {
  if (content == null) return ''
  if (Array.isArray(content)) return content.map(extractText).join('')
  if (typeof content === 'string') return content
  if (content.type === 'text') return content.text ?? ''
  if (content.content) return extractText(content.content)
  return ''
}

let uid = 0
const nextId = () => `b${++uid}`

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [currentModelId, setCurrentModelId] = useState<string | null>(null)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [contextUsage, setContextUsage] = useState<number | null>(null)
  const [creditsUsed, setCreditsUsed] = useState(0)
  const [creditsUnit, setCreditsUnit] = useState('créditos')
  const [updateReady, setUpdateReady] = useState<{ version: string; notes: string[] } | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [hasExchanged, setHasExchanged] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoConnectStarted = useRef(false)
  const composerRef = useRef<ComposerHandle>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  async function refreshSessions() {
    const list = await window.kiro.listSessions()
    setSessions(list)
  }

  useEffect(() => {
    refreshSessions()
    if (autoConnectStarted.current) return
    autoConnectStarted.current = true
    window.kiro
      .getDefaultFolder()
      .then((folder) => connectTo(folder))
      .catch((err) => console.error('Falha ao abrir a pasta padrão:', err))
  }, [])

  useEffect(() => {
    const offNotif = window.kiro.onNotification((method, params) => {
      if (method === '_kiro.dev/metadata') {
        if (typeof params?.contextUsagePercentage === 'number') {
          setContextUsage(params.contextUsagePercentage)
        }
        if (Array.isArray(params?.meteringUsage) && params.meteringUsage.length > 0) {
          const add = params.meteringUsage.reduce((sum: number, m: any) => sum + (m.value ?? 0), 0)
          setCreditsUsed((prev) => prev + add)
          setCreditsUnit(params.meteringUsage[0].unitPlural ?? params.meteringUsage[0].unit ?? 'créditos')
        }
        return
      }
      if (method !== 'session/update') return
      const upd = params?.update
      if (!upd) return

      setBlocks((prev) => {
        const next = [...prev]

        if (upd.sessionUpdate === 'agent_message_chunk') {
          const text = extractText(upd.content)
          const last = next[next.length - 1]
          if (last && last.kind === 'assistant') {
            next[next.length - 1] = { ...last, text: last.text + text }
          } else {
            next.push({ kind: 'assistant', id: nextId(), text })
          }
          return next
        }

        if (upd.sessionUpdate === 'agent_thought_chunk') {
          const text = extractText(upd.content)
          const last = next[next.length - 1]
          if (last && last.kind === 'thought') {
            next[next.length - 1] = { ...last, text: last.text + text }
          } else {
            next.push({ kind: 'thought', id: nextId(), text })
          }
          return next
        }

        if (upd.sessionUpdate === 'tool_call') {
          next.push({
            kind: 'tool',
            id: nextId(),
            toolCallId: upd.toolCallId,
            title: upd.title ?? upd.kind ?? 'Ferramenta',
            status: upd.status ?? 'pending',
            contentText: extractText(upd.content)
          })
          return next
        }

        if (upd.sessionUpdate === 'tool_call_update') {
          const idx = next.findIndex((b) => b.kind === 'tool' && b.toolCallId === upd.toolCallId)
          if (idx >= 0) {
            const existing = next[idx] as Extract<Block, { kind: 'tool' }>
            next[idx] = {
              ...existing,
              status: upd.status ?? existing.status,
              contentText: upd.content ? extractText(upd.content) : existing.contentText
            }
          }
          return next
        }

        return next
      })
    })

    const offPerm = window.kiro.onPermissionRequest((id, params) => {
      const toolTitle = params?.toolCall?.title ?? params?.toolCall?.kind ?? 'uma ação'
      setPermissionRequest({
        id,
        title: `O Kiro quer executar: ${toolTitle}`,
        options: params.options ?? []
      })
    })

    const offExit = window.kiro.onExit(() => {
      setConnected(false)
      setBusy(false)
    })

    const offUpdate = window.kiro.onUpdateReady((version, notes) => {
      setUpdateReady({ version, notes })
    })

    return () => {
      offNotif()
      offPerm()
      offExit()
      offUpdate()
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [blocks])

  async function connectTo(folder: string) {
    const { sessionResult } = await window.kiro.start(folder)
    setCwd(folder)
    setConnected(true)
    setModels(sessionResult?.models?.availableModels ?? [])
    setCurrentModelId(sessionResult?.models?.currentModelId ?? null)
    if (sessionResult?.sessionId) setActiveSessionId(sessionResult.sessionId)
    setContextUsage(null)
    setCreditsUsed(0)
    setHasExchanged(false)
  }

  async function openFolder() {
    const folder = await window.kiro.pickFolder()
    if (!folder) return
    setBlocks([])
    setActiveSessionId(null)
    await connectTo(folder)
  }

  async function onNewChat() {
    setBlocks([])
    setActiveSessionId(null)
    if (cwd) await connectTo(cwd)
  }

  async function onOpenSession(session: SessionSummary) {
    const turns = await window.kiro.readTranscript(session.sessionId)
    setBlocks(
      turns.map((t) => ({ kind: t.role, id: nextId(), text: t.text }) as Block)
    )
    setActiveSessionId(session.sessionId)
    await connectTo(session.cwd)
    if (turns.length > 0) setHasExchanged(true)
  }

  async function sendMessage(text: string, attachments: Attachment[]) {
    setBlocks((prev) => [...prev, { kind: 'user', id: nextId(), text, attachments }])
    setBusy(true)
    setHasExchanged(true)
    try {
      const parts: any[] = []
      if (text) parts.push({ type: 'text', text })
      for (const a of attachments) {
        if (a.kind === 'image') {
          parts.push({ type: 'image', data: a.data, mimeType: a.mimeType })
        } else if (a.kind === 'text') {
          parts.push({ type: 'text', text: `Arquivo anexado "${a.name}":\n\`\`\`\n${a.text}\n\`\`\`` })
        }
      }
      await window.kiro.prompt(parts)
    } catch {
      // cancelled or failed; nothing else to do here
    } finally {
      setBusy(false)
      refreshSessions()
    }
  }

  function cancelPrompt() {
    window.kiro.cancel()
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!connected) return
    dragCounter.current += 1
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (!connected) return
    if (e.dataTransfer.files.length > 0) composerRef.current?.addFiles(e.dataTransfer.files)
  }

  function restartToUpdate() {
    window.kiro.restartToUpdate()
  }

  function closeUpdateModal() {
    setShowUpdateModal(false)
  }

  async function renameSession(sessionId: string, title: string) {
    await window.kiro.renameSession(sessionId, title)
    refreshSessions()
  }

  async function deleteSession(sessionId: string) {
    await window.kiro.deleteSession(sessionId)
    if (sessionId === activeSessionId) {
      setActiveSessionId(null)
      setBlocks([])
    }
    refreshSessions()
  }

  function choosePermission(optionId: string) {
    if (!permissionRequest) return
    window.kiro.respondPermission(permissionRequest.id, optionId)
    setPermissionRequest(null)
  }

  const modelName = models.find((m) => m.modelId === currentModelId)?.name ?? currentModelId
  const activeTitle =
    sessions.find((s) => s.sessionId === activeSessionId)?.title ?? (cwd ? 'Nova conversa' : 'Kiro Code')
  const folderLabel = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd : null

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="app-drop-overlay">
          <PaperclipIcon width={28} height={28} />
          Solte para anexar ao Kiro
        </div>
      )}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onNewChat={onNewChat}
        onOpenSession={onOpenSession}
        onOpenFolder={openFolder}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
        onOpenInExplorer={(path) => window.kiro.openInExplorer(path)}
      />

      <div className="main-column">
        <TopBar
          title={activeTitle}
          folderLabel={folderLabel}
          updateVersion={updateReady?.version ?? null}
          onOpenUpdate={() => setShowUpdateModal(true)}
        />

        <div className="timeline-wrap">
        <div className="timeline" ref={scrollRef}>
          {blocks.length === 0 && (
            <div className="empty-state">
              <h2>Kiro Code</h2>
              <p>Abra uma pasta de projeto para começar a conversar com o seu agente Kiro.</p>
            </div>
          )}
          {blocks.map((block) => {
            if (block.kind === 'user') {
              return (
                <div key={block.id} className="msg msg--user">
                  <div className="msg__bubble">
                    {block.attachments && block.attachments.length > 0 && (
                      <div className="msg__attachments">
                        {block.attachments.map((a) =>
                          a.kind === 'image' ? (
                            <img
                              key={a.id}
                              src={`data:${a.mimeType};base64,${a.data}`}
                              alt={a.name}
                              title={a.name}
                              className="attachment-chip__thumb attachment-chip__thumb--static"
                              onClick={() => setLightboxSrc(`data:${a.mimeType};base64,${a.data}`)}
                            />
                          ) : (
                            <span
                              key={a.id}
                              className={`attachment-chip attachment-chip--static ${a.filePath ? 'attachment-chip--clickable' : ''}`}
                              onClick={() => a.filePath && window.kiro.openInExplorer(a.filePath)}
                              title={a.filePath ? 'Abrir arquivo' : undefined}
                            >
                              <FileIcon
                                width={13}
                                height={13}
                                className={`attachment-chip__icon attachment-chip__icon--${a.fileCategory ?? 'generic'}`}
                              />
                              {a.name}
                            </span>
                          )
                        )}
                      </div>
                    )}
                    {block.text}
                  </div>
                </div>
              )
            }
            if (block.kind === 'assistant') {
              return (
                <div key={block.id} className="msg msg--assistant">
                  <div className="msg__bubble markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        )
                      }}
                    >
                      {block.text}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            }
            if (block.kind === 'thought') {
              return (
                <div key={block.id} className="msg msg--thought">
                  {block.text}
                </div>
              )
            }
            return <ToolCallCard key={block.id} block={block} />
          })}
          {blocks.length > 0 && (
            <div className="chat-end-ghost" key={blocks.length}>
              <img src="./icon.png" alt="" className="typing-indicator__ghost" />
              {busy && <span>Kiro está trabalhando…</span>}
            </div>
          )}
        </div>
        <div className="timeline-fade timeline-fade--top" />
        <div className="timeline-fade timeline-fade--bottom" />
        </div>

        <Composer
          ref={composerRef}
          disabled={!connected}
          busy={busy}
          connected={connected}
          modelName={modelName ?? null}
          contextUsage={hasExchanged ? contextUsage : null}
          creditsUsed={hasExchanged ? creditsUsed : 0}
          creditsUnit={creditsUnit}
          onSend={sendMessage}
          onCancel={cancelPrompt}
          onPreviewImage={setLightboxSrc}
        />
      </div>

      {permissionRequest && <PermissionModal request={permissionRequest} onChoose={choosePermission} />}

      {updateReady && showUpdateModal && (
        <UpdateModal
          version={updateReady.version}
          notes={updateReady.notes}
          onRestart={restartToUpdate}
          onLater={closeUpdateModal}
        />
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}
