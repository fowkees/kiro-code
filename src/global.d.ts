export {}

declare global {
  interface Window {
    kiro: {
      pickFolder(): Promise<string | null>
      start(cwd: string): Promise<any>
      openSession(cwd: string, sessionId: string): Promise<any>
      prompt(parts: any[]): Promise<any>
      cancel(): Promise<void>
      setModel(modelId: string): Promise<any>
      stop(): Promise<void>
      openInExplorer(path: string): Promise<void>
      extractPdfText(path: string): Promise<string>
      getDefaultFolder(): Promise<string>
      getAppVersion(): Promise<string>
      sendFeedback(message: string): Promise<{ ok: boolean }>
      getSettings(): Promise<import('./types').AppSettings>
      setSettings(partial: Partial<import('./types').AppSettings>): Promise<import('./types').AppSettings>
      getStartupFolder(): Promise<string>
      restartToUpdate(): Promise<void>
      onUpdateReady(cb: (version: string, notes: string[]) => void): () => void
      respondPermission(id: number, optionId: string): Promise<void>
      listSessions(): Promise<import('./types').SessionSummary[]>
      readTranscript(sessionId: string): Promise<{ role: 'user' | 'assistant'; text: string }[]>
      deleteSession(sessionId: string): Promise<void>
      renameSession(sessionId: string, title: string): Promise<void>
      onNotification(cb: (method: string, params: any) => void): () => void
      onPermissionRequest(cb: (id: number, params: any) => void): () => void
      onExit(cb: (code: number | null) => void): () => void
      onBrowserNavigate(cb: (url: string) => void): () => void
      onBrowserExec(cb: (id: number, action: string, params: any) => void): () => void
      sendBrowserExecResult(id: number, result: any): void
    }
  }
}
