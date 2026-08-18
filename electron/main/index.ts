import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AcpClient } from './acp'
import { deleteSession, listSessions, readTranscript, renameSession } from './sessions'
import { getLastFolder, getSettings, setLastFolder, setSettings } from './state'
import {
  BROWSER_MCP_NAME,
  getBrowserMcpServerConfig,
  onBrowserNavigate,
  setBrowserExecHandler,
  setConsoleSource,
  startBrowserMcpServer
} from './browserMcp'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const { autoUpdater } = electronUpdater

let win: BrowserWindow | null = null

function sendToWindow(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

let client: AcpClient | null = null
let permRequestId = 0
const pendingPermissions = new Map<number, (optionId: string) => void>()

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    show: false,
    backgroundColor: '#15161a',
    icon: join(__dirname, '../../resources/icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1c1d23',
      symbolColor: '#e7e7ea',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      webviewTag: true
    }
  })

  win.once('ready-to-show', () => {
    win?.maximize()
    win?.show()
  })

  win.on('closed', () => {
    win = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('did-attach-webview', (_event, contents) => {
    setConsoleSource(contents)
    contents.setWindowOpenHandler(({ url }) => {
      contents.loadURL(url)
      return { action: 'deny' }
    })
  })

  onBrowserNavigate((url) => sendToWindow('browser:navigate', url))

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function stopClient(): Promise<void> {
  if (!client) return
  const c = client
  client = null
  c.removeAllListeners()
  await c.stop()
}

app.setAppUserModelId('com.kirodesktop.app')

async function fetchChangelog(version: string): Promise<string[]> {
  try {
    const res = await fetch('https://updates.feedbacksele.com.br/changelog.json')
    if (!res.ok) return []
    const data = await res.json()
    return data[version] ?? []
  } catch {
    return []
  }
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const notes = await fetchChangelog(info.version)
    sendToWindow('kiro:updateReady', { version: info.version, notes })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err)
  })

  const runCheck = () => autoUpdater.checkForUpdates().catch((err) => console.error('checkForUpdates failed:', err))

  runCheck()
  setInterval(runCheck, 15 * 60 * 1000)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  setupAutoUpdater()
  startBrowserMcpServer()

  let execRequestId = 0
  const pendingExecRequests = new Map<number, (result: any) => void>()

  ipcMain.on('browser:execResult', (_e, { id, result }: { id: number; result: any }) => {
    const resolve = pendingExecRequests.get(id)
    if (resolve) {
      pendingExecRequests.delete(id)
      resolve(result)
    }
  })

  setBrowserExecHandler((action, params) => {
    return new Promise((resolve) => {
      const id = ++execRequestId
      pendingExecRequests.set(id, resolve)
      sendToWindow('browser:exec', { id, action, params })
      setTimeout(() => {
        if (pendingExecRequests.has(id)) {
          pendingExecRequests.delete(id)
          resolve({ error: 'Tempo esgotado esperando o painel de navegador responder.' })
        }
      }, 15000)
    })
  })

  ipcMain.handle('kiro:pickFolder', async () => {
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  async function initClient(cwd: string): Promise<any> {
    await stopClient()
    client = new AcpClient()

    client.on('notification', (method, params) => {
      sendToWindow('kiro:notification', { method, params })
    })
    client.on('stderr', (chunk: string) => {
      sendToWindow('kiro:stderr', chunk)
    })
    client.on('exit', (code: number | null) => {
      sendToWindow('kiro:exit', code)
    })
    client.onIncomingRequest(async (method, params) => {
      if (method === 'session/request_permission') {
        const title: string = params?.toolCall?.title ?? ''
        if (getSettings().browserAutoApprove && title.includes(`@${BROWSER_MCP_NAME}/`)) {
          const allowOption =
            params.options.find((o: any) => o.kind === 'allow_once') ??
            params.options.find((o: any) => o.kind === 'allow_always') ??
            params.options[0]
          return { outcome: { outcome: 'selected', optionId: allowOption.optionId } }
        }

        const id = ++permRequestId
        const decision = await new Promise<string>((resolve) => {
          pendingPermissions.set(id, resolve)
          sendToWindow('kiro:permissionRequest', { id, params })
        })
        const option = params.options.find((o: any) => o.optionId === decision) ?? params.options[0]
        return { outcome: { outcome: 'selected', optionId: option.optionId } }
      }
      throw new Error(`Unsupported incoming method: ${method}`)
    })

    client.start(cwd)
    return client.initialize('kiro-desktop', app.getVersion())
  }

  let clientOpChain: Promise<any> = Promise.resolve()
  function queueClientOp<T>(fn: () => Promise<T>): Promise<T> {
    const result = clientOpChain.then(fn, fn)
    clientOpChain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  ipcMain.handle('kiro:start', (_e, cwd: string) =>
    queueClientOp(async () => {
      const initResult = await initClient(cwd)
      const sessionResult = await client!.newSession(cwd, [getBrowserMcpServerConfig()])
      setLastFolder(cwd)
      return { initResult, sessionResult }
    })
  )

  ipcMain.handle('kiro:openSession', (_e, { cwd, sessionId }: { cwd: string; sessionId: string }) =>
    queueClientOp(async () => {
      const initResult = await initClient(cwd)
      const sessionResult = await client!.loadSession(cwd, sessionId, [getBrowserMcpServerConfig()])
      setLastFolder(cwd)
      return { initResult, sessionResult }
    })
  )

  ipcMain.handle('kiro:prompt', async (_e, parts: any[]) => {
    if (!client) throw new Error('Session not started')
    return client.prompt(parts)
  })

  ipcMain.handle('kiro:cancel', () => client?.cancel())

  ipcMain.handle('kiro:setModel', async (_e, modelId: string) => {
    if (!client) throw new Error('Session not started')
    return client.setModel(modelId)
  })

  ipcMain.handle('kiro:permissionResponse', (_e, { id, optionId }: { id: number; optionId: string }) => {
    const resolve = pendingPermissions.get(id)
    if (resolve) {
      resolve(optionId)
      pendingPermissions.delete(id)
    }
  })

  ipcMain.handle('kiro:stop', () => stopClient())

  ipcMain.handle('kiro:openInExplorer', (_e, path: string) => shell.openPath(path))

  ipcMain.handle('kiro:extractPdfText', async (_e, path: string) => {
    try {
      const { PDFParse } = await import('pdf-parse')
      const data = readFileSync(path)
      const parser = new PDFParse({ data })
      const result = await parser.getText()
      return result.text
    } catch (err: any) {
      return `(não foi possível ler o conteúdo do PDF: ${err?.message ?? err})`
    }
  })

  ipcMain.handle('kiro:getDefaultFolder', () => {
    const dir = getSettings().defaultFolder ?? join(homedir(), 'projects', 'kiro')
    mkdirSync(dir, { recursive: true })
    return dir
  })

  ipcMain.handle('kiro:getStartupFolder', () => {
    const last = getLastFolder()
    if (last && existsSync(last)) return last
    const dir = getSettings().defaultFolder ?? join(homedir(), 'projects', 'kiro')
    mkdirSync(dir, { recursive: true })
    return dir
  })

  ipcMain.handle('kiro:getAppVersion', () => app.getVersion())

  ipcMain.handle('kiro:sendFeedback', async (_e, message: string) => {
    try {
      const res = await fetch('https://updates.feedbacksele.com.br/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, version: app.getVersion() })
      })
      if (!res.ok) return { ok: false }
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
  ipcMain.handle('kiro:getSettings', () => getSettings())
  ipcMain.handle('kiro:setSettings', (_e, partial: Partial<ReturnType<typeof getSettings>>) => setSettings(partial))

  ipcMain.handle('kiro:restartToUpdate', () => autoUpdater.quitAndInstall(true, true))

  ipcMain.handle('kiro:listSessions', () => listSessions())
  ipcMain.handle('kiro:readTranscript', (_e, sessionId: string) => readTranscript(sessionId))
  ipcMain.handle('kiro:deleteSession', (_e, sessionId: string) => deleteSession(sessionId))
  ipcMain.handle('kiro:renameSession', (_e, { sessionId, title }: { sessionId: string; title: string }) =>
    renameSession(sessionId, title)
  )

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopClient()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', stopClient)
