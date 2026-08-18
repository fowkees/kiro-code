import { DragEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TopBar from './components/TopBar'
import Composer, { ComposerHandle } from './components/Composer'
import ToolCallCard from './components/ToolCallCard'
import PermissionModal from './components/PermissionModal'
import Sidebar from './components/Sidebar'
import BrowserPanel from './components/BrowserPanel'
import SettingsModal from './components/SettingsModal'
import FeedbackModal from './components/FeedbackModal'
import UpdateModal from './components/UpdateModal'
import ImageLightbox from './components/ImageLightbox'
import { CheckIcon, CopyIcon, FileIcon, PaperclipIcon } from './components/icons'
import { AppSettings, Attachment, Block, ModelInfo, PermissionRequest, SessionSummary } from './types'

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

const FONT_SIZE_PX: Record<AppSettings['fontSize'], string> = {
  small: '13px',
  medium: '14px',
  large: '16px'
}

function CodeBlock({ children, ...props }: any) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  function copy() {
    const text = preRef.current?.innerText ?? ''
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <button
        className={`code-block__copy ${copied ? 'code-block__copy--done' : ''}`}
        onClick={copy}
        title="Copiar código"
      >
        {copied ? <CheckIcon width={12} height={12} /> : <CopyIcon width={12} height={12} />}
      </button>
      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
  const [sidebarWidth, setSidebarWidth] = useState(264)
  const resizingSidebar = useRef(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const [contextUsage, setContextUsage] = useState<number | null>(null)
  const [creditsUsed, setCreditsUsed] = useState(0)
  const [creditsUnit, setCreditsUnit] = useState('créditos')
  const [updateReady, setUpdateReady] = useState<{ version: string; notes: string[] } | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [hasExchanged, setHasExchanged] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [settings, setSettingsState] = useState<AppSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [browserWidth, setBrowserWidth] = useState(420)
  const resizingBrowser = useRef(false)
  const browserPanelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoConnectStarted = useRef(false)
  const composerRef = useRef<ComposerHandle>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const suppressReplayRef = useRef(false)

  async function refreshSessions() {
    const list = await window.kiro.listSessions()
    setSessions(list)
  }

  useEffect(() => {
    refreshSessions()
    if (autoConnectStarted.current) return
    autoConnectStarted.current = true
    window.kiro
      .getStartupFolder()
      .then((folder) => connectTo(folder))
      .catch((err) => console.error('Falha ao abrir a pasta inicial:', err))
    window.kiro.getSettings().then(setSettingsState)
  }, [])

  useEffect(() => {
    if (!settings) return
    const root = document.documentElement.style
    root.setProperty('--accent', settings.accentColor)
    root.setProperty('--accent-soft', hexToRgba(settings.accentColor, 0.15))
    root.setProperty('--chat-font-size', FONT_SIZE_PX[settings.fontSize])
  }, [settings])

  async function updateSettings(partial: Partial<AppSettings>) {
    const next = await window.kiro.setSettings(partial)
    setSettingsState(next)
  }

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
      if (suppressReplayRef.current) return
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

        if (upd.sessionUpdate === 'user_message_chunk') {
          const text = extractText(upd.content)
          const last = next[next.length - 1]
          if (last && last.kind === 'user') {
            next[next.length - 1] = { ...last, text: last.text + text }
          } else {
            next.push({ kind: 'user', id: nextId(), text })
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
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 150) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [blocks])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [activeSessionId])

  useEffect(() => {
    return window.kiro.onBrowserNavigate(() => setBrowserOpen(true))
  }, [])

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
    const folder = await window.kiro.getDefaultFolder()
    await connectTo(folder)
  }

  async function onOpenSession(session: SessionSummary) {
    const turns = await window.kiro.readTranscript(session.sessionId)
    setBlocks(turns.map((t) => ({ kind: t.role, id: nextId(), text: t.text }) as Block))
    setActiveSessionId(session.sessionId)
    setCwd(session.cwd)
    setHasExchanged(turns.length > 0)
    setContextUsage(null)
    setCreditsUsed(0)

    suppressReplayRef.current = true
    try {
      const { sessionResult } = await window.kiro.openSession(session.cwd, session.sessionId)
      setConnected(true)
      setModels(sessionResult?.models?.availableModels ?? [])
      setCurrentModelId(sessionResult?.models?.currentModelId ?? null)
      setActiveSessionId(session.sessionId)
    } finally {
      suppressReplayRef.current = false
    }
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

  function copyMessage(id: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500)
  }

  async function selectModel(modelId: string) {
    setCurrentModelId(modelId)
    try {
      await window.kiro.setModel(modelId)
    } catch (err) {
      console.error('Falha ao trocar de modelo:', err)
    }
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

  function startSidebarResize(e: ReactMouseEvent) {
    e.preventDefault()
    resizingSidebar.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    let lastWidth = sidebarWidth

    function onMove(ev: MouseEvent) {
      if (!resizingSidebar.current) return
      lastWidth = Math.min(480, Math.max(200, ev.clientX))
      if (sidebarRef.current) sidebarRef.current.style.width = `${lastWidth}px`
    }
    function onUp() {
      resizingSidebar.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setSidebarWidth(lastWidth)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function startBrowserResize(e: ReactMouseEvent) {
    e.preventDefault()
    resizingBrowser.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.body.classList.add('resizing-browser-panel')
    let lastWidth = browserWidth

    function onMove(ev: MouseEvent) {
      if (!resizingBrowser.current) return
      const maxWidth = Math.max(280, window.innerWidth - 380)
      lastWidth = Math.min(maxWidth, Math.max(280, window.innerWidth - ev.clientX))
      if (browserPanelRef.current) browserPanelRef.current.style.width = `${lastWidth}px`
    }
    function onUp() {
      resizingBrowser.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.body.classList.remove('resizing-browser-panel')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setBrowserWidth(lastWidth)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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
        width={sidebarWidth}
        collapsed={sidebarCollapsed}
        panelRef={sidebarRef}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onNewChat={onNewChat}
        onOpenSession={onOpenSession}
        onOpenFolder={openFolder}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
        onOpenInExplorer={(path) => window.kiro.openInExplorer(path)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenFeedback={() => setShowFeedback(true)}
      />

      {!sidebarCollapsed && <div className="sidebar-resize-handle" onMouseDown={startSidebarResize} />}

      <div className="main-column">
        <TopBar
          title={activeTitle}
          folderLabel={folderLabel}
          updateVersion={updateReady?.version ?? null}
          browserOpen={browserOpen}
          onToggleBrowser={() => setBrowserOpen((v) => !v)}
          onOpenUpdate={() => setShowUpdateModal(true)}
        />

        <div className="timeline-wrap">
        <div className="timeline" ref={scrollRef}>
          {blocks.length === 0 && (
            <div className="empty-state">
              <img src="./mascot.png" alt="" className="empty-state__mascot" />
              <h2>Kiro Code</h2>
              <p>Abra uma pasta de projeto para começar a conversar com o seu agente Kiro.</p>
            </div>
          )}
          {blocks.map((block, blockIndex) => {
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
              const isStreaming = busy && blockIndex === blocks.length - 1
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
                        ),
                        pre: CodeBlock
                      }}
                    >
                      {block.text}
                    </ReactMarkdown>
                    {isStreaming && <span className="typing-cursor" />}
                  </div>
                  {!isStreaming && block.text && (
                    <button
                      className="msg__copy-btn"
                      onClick={() => copyMessage(block.id, block.text)}
                      title="Copiar mensagem"
                    >
                      {copiedId === block.id ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
                    </button>
                  )}
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
          cwd={cwd}
          models={models}
          currentModelId={currentModelId}
          onSelectModel={selectModel}
          contextUsage={hasExchanged ? contextUsage : null}
          creditsUsed={hasExchanged ? creditsUsed : 0}
          creditsUnit={creditsUnit}
          onSend={sendMessage}
          onCancel={cancelPrompt}
          onPreviewImage={setLightboxSrc}
        />
      </div>

      {browserOpen && <div className="browser-resize-handle" onMouseDown={startBrowserResize} />}

      <BrowserPanel
        visible={browserOpen}
        width={browserWidth}
        panelRef={browserPanelRef}
        onClose={() => setBrowserOpen(false)}
      />

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

      {showSettings && settings && (
        <SettingsModal settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />
      )}

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  )
}
