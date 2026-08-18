import { contextBridge, ipcRenderer } from 'electron'

const api = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('kiro:pickFolder'),
  start: (cwd: string) => ipcRenderer.invoke('kiro:start', cwd),
  openSession: (cwd: string, sessionId: string) => ipcRenderer.invoke('kiro:openSession', { cwd, sessionId }),
  prompt: (parts: any[]) => ipcRenderer.invoke('kiro:prompt', parts),
  cancel: () => ipcRenderer.invoke('kiro:cancel'),
  setModel: (modelId: string) => ipcRenderer.invoke('kiro:setModel', modelId),
  stop: () => ipcRenderer.invoke('kiro:stop'),
  openInExplorer: (path: string) => ipcRenderer.invoke('kiro:openInExplorer', path),
  extractPdfText: (path: string) => ipcRenderer.invoke('kiro:extractPdfText', path),
  getDefaultFolder: () => ipcRenderer.invoke('kiro:getDefaultFolder'),
  getStartupFolder: () => ipcRenderer.invoke('kiro:getStartupFolder'),
  restartToUpdate: () => ipcRenderer.invoke('kiro:restartToUpdate'),
  onUpdateReady: (cb: (version: string, notes: string[]) => void) => {
    const listener = (_e: unknown, payload: { version: string; notes: string[] }) =>
      cb(payload.version, payload.notes)
    ipcRenderer.on('kiro:updateReady', listener)
    return () => ipcRenderer.removeListener('kiro:updateReady', listener)
  },
  listSessions: () => ipcRenderer.invoke('kiro:listSessions'),
  readTranscript: (sessionId: string) => ipcRenderer.invoke('kiro:readTranscript', sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('kiro:deleteSession', sessionId),
  renameSession: (sessionId: string, title: string) =>
    ipcRenderer.invoke('kiro:renameSession', { sessionId, title }),
  respondPermission: (id: number, optionId: string) =>
    ipcRenderer.invoke('kiro:permissionResponse', { id, optionId }),
  onNotification: (cb: (method: string, params: any) => void) => {
    const listener = (_e: unknown, payload: { method: string; params: any }) =>
      cb(payload.method, payload.params)
    ipcRenderer.on('kiro:notification', listener)
    return () => ipcRenderer.removeListener('kiro:notification', listener)
  },
  onPermissionRequest: (cb: (id: number, params: any) => void) => {
    const listener = (_e: unknown, payload: { id: number; params: any }) =>
      cb(payload.id, payload.params)
    ipcRenderer.on('kiro:permissionRequest', listener)
    return () => ipcRenderer.removeListener('kiro:permissionRequest', listener)
  },
  onExit: (cb: (code: number | null) => void) => {
    const listener = (_e: unknown, code: number | null) => cb(code)
    ipcRenderer.on('kiro:exit', listener)
    return () => ipcRenderer.removeListener('kiro:exit', listener)
  }
}

contextBridge.exposeInMainWorld('kiro', api)

export type KiroApi = typeof api
