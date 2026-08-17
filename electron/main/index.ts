import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AcpClient } from './acp'
import { deleteSession, listSessions, readTranscript, renameSession } from './sessions'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const { autoUpdater } = electronUpdater

let win: BrowserWindow | null = null
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
      sandbox: false
    }
  })

  win.once('ready-to-show', () => {
    win?.maximize()
    win?.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function stopClient(): void {
  client?.stop()
  client = null
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
    win?.webContents.send('kiro:updateReady', { version: info.version, notes })
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

  ipcMain.handle('kiro:pickFolder', async () => {
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('kiro:start', async (_e, cwd: string) => {
    stopClient()
    client = new AcpClient()

    client.on('notification', (method, params) => {
      win?.webContents.send('kiro:notification', { method, params })
    })
    client.on('stderr', (chunk: string) => {
      win?.webContents.send('kiro:stderr', chunk)
    })
    client.on('exit', (code: number | null) => {
      win?.webContents.send('kiro:exit', code)
    })
    client.onIncomingRequest(async (method, params) => {
      if (method === 'session/request_permission') {
        const id = ++permRequestId
        const decision = await new Promise<string>((resolve) => {
          pendingPermissions.set(id, resolve)
          win?.webContents.send('kiro:permissionRequest', { id, params })
        })
        const option = params.options.find((o: any) => o.optionId === decision) ?? params.options[0]
        return { outcome: { outcome: 'selected', optionId: option.optionId } }
      }
      throw new Error(`Unsupported incoming method: ${method}`)
    })

    client.start(cwd)
    const initResult = await client.initialize('kiro-desktop', app.getVersion())
    const sessionResult = await client.newSession(cwd)
    return { initResult, sessionResult }
  })

  ipcMain.handle('kiro:prompt', async (_e, parts: any[]) => {
    if (!client) throw new Error('Session not started')
    return client.prompt(parts)
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

  ipcMain.handle('kiro:getDefaultFolder', () => {
    const dir = join(homedir(), 'projects', 'kiro')
    mkdirSync(dir, { recursive: true })
    return dir
  })

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
