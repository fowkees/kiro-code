import { KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, RefreshIcon, XIcon } from './icons'

const BLANK_PAGE = `data:text/html,${encodeURIComponent('<html><body style="margin:0;background:#15161a"></body></html>')}`

function normalizeUrl(input: string): string {
  const value = input.trim()
  if (!value) return BLANK_PAGE
  if (/^[a-z]+:\/\//i.test(value)) return value
  if (/^localhost(:\d+)?/.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`
}

export default function BrowserPanel({
  visible,
  width,
  panelRef,
  onClose
}: {
  visible: boolean
  width: number
  panelRef: RefObject<HTMLDivElement>
  onClose: () => void
}) {
  const webviewRef = useRef<any>(null)
  const [url, setUrl] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const el = webviewRef.current
    if (!el) return
    const onNav = (e: any) => {
      setUrl(e.url)
      setInputValue(e.url.startsWith('data:') ? '' : e.url)
    }
    el.addEventListener('did-navigate', onNav)
    el.addEventListener('did-navigate-in-page', onNav)
    return () => {
      el.removeEventListener('did-navigate', onNav)
      el.removeEventListener('did-navigate-in-page', onNav)
    }
  }, [])

  useEffect(() => {
    return window.kiro.onBrowserNavigate((navUrl) => {
      setUrl(navUrl)
      setInputValue(navUrl)
    })
  }, [])

  useEffect(() => {
    return window.kiro.onBrowserExec(async (id, action, params) => {
      const el = webviewRef.current
      let result: any = {}
      try {
        if (!el) throw new Error('O painel de navegador ainda não está pronto.')
        if (action === 'navigate') {
          await el.loadURL(params.url)
        } else if (action === 'screenshot') {
          const image = await el.capturePage()
          result = { data: image.toDataURL().replace(/^data:image\/png;base64,/, '') }
        } else if (action === 'get_page_text') {
          const text = await el.executeJavaScript('document.body ? document.body.innerText : ""')
          result = { text }
        } else if (action === 'click') {
          const x = Number(params.x)
          const y = Number(params.y)
          await el.executeJavaScript(
            `(function(){var e=document.elementFromPoint(${x}, ${y}); if(e) e.click();})()`
          )
        }
      } catch (err: any) {
        result = { error: err?.message ?? String(err) }
      }
      window.kiro.sendBrowserExecResult(id, result)
    })
  }, [])

  function go(target: string) {
    const dest = normalizeUrl(target)
    webviewRef.current?.loadURL(dest)
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') go(inputValue)
    else if (e.key === 'Escape') {
      setInputValue(url)
      setEditing(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div
      ref={panelRef}
      className={`browser-panel ${visible ? '' : 'browser-panel--hidden'}`}
      style={visible ? { width } : undefined}
    >
      <div className="browser-panel__toolbar">
        <button className="browser-panel__nav-btn" onClick={() => webviewRef.current?.goBack()} title="Voltar">
          <ArrowLeftIcon width={14} height={14} />
        </button>
        <button
          className="browser-panel__nav-btn browser-panel__nav-btn--fwd"
          onClick={() => webviewRef.current?.goForward()}
          title="Avançar"
        >
          <ArrowLeftIcon width={14} height={14} />
        </button>
        <button className="browser-panel__nav-btn" onClick={() => webviewRef.current?.reload()} title="Recarregar">
          <RefreshIcon width={13} height={13} />
        </button>
        <input
          className="browser-panel__url"
          value={editing ? inputValue : url.startsWith('data:') ? '' : url}
          placeholder="Digite um endereço ou busque"
          onFocus={(e) => {
            setEditing(true)
            e.target.select()
          }}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setEditing(false)}
        />
        <button className="browser-panel__close" onClick={onClose} title="Fechar">
          <XIcon width={13} height={13} />
        </button>
      </div>
      <webview ref={webviewRef} src={BLANK_PAGE} className="browser-panel__view" allowpopups />
    </div>
  )
}
