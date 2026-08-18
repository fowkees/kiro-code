import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

interface PendingRequest {
  resolve: (value: any) => void
  reject: (err: Error) => void
}

type IncomingRequestHandler = (method: string, params: any) => Promise<any>

/**
 * Minimal client for the Agent Client Protocol (ACP) as spoken by `kiro-cli acp`:
 * newline-delimited JSON-RPC 2.0 over stdio, with the agent able to send us
 * requests of its own (e.g. session/request_permission) that we must answer.
 */
export class AcpClient extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private incomingHandler: IncomingRequestHandler | null = null

  sessionId: string | null = null

  onIncomingRequest(handler: IncomingRequestHandler) {
    this.incomingHandler = handler
  }

  start(cwd: string): void {
    if (this.proc) throw new Error('ACP process already running')
    this.proc = spawn('kiro-cli', ['acp'], { cwd, windowsHide: true })
    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk: string) => this.onData(chunk))
    this.proc.stderr.setEncoding('utf8')
    this.proc.stderr.on('data', (chunk: string) => this.emit('stderr', chunk))
    this.proc.on('exit', (code) => {
      this.emit('exit', code)
      this.proc = null
      for (const { reject } of this.pending.values()) reject(new Error('ACP process exited'))
      this.pending.clear()
    })
  }

  stop(): Promise<void> {
    const proc = this.proc
    if (!proc) return Promise.resolve()
    return new Promise((resolve) => {
      proc.once('exit', () => resolve())
      proc.kill()
      setTimeout(resolve, 3000)
    })
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      this.handleMessage(msg)
    }
  }

  private async handleMessage(msg: any): Promise<void> {
    if (msg.id !== undefined && msg.method) {
      // Request FROM the agent to us.
      try {
        const result = this.incomingHandler
          ? await this.incomingHandler(msg.method, msg.params)
          : null
        this.send({ jsonrpc: '2.0', id: msg.id, result })
      } catch (err: any) {
        this.send({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32000, message: err?.message ?? String(err) }
        })
      }
      return
    }
    if (msg.id !== undefined) {
      // Response to one of our requests.
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      if (msg.error) pending.reject(new Error(msg.error.message ?? 'ACP error'))
      else pending.resolve(msg.result)
      return
    }
    if (msg.method) {
      // Notification.
      this.emit('notification', msg.method, msg.params)
    }
  }

  private send(msg: any): void {
    this.proc?.stdin.write(JSON.stringify(msg) + '\n')
  }

  notify(method: string, params?: any): void {
    this.send({ jsonrpc: '2.0', method, params })
  }

  request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.proc) return Promise.reject(new Error('ACP process not running'))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.send({ jsonrpc: '2.0', id, method, params })
    })
  }

  async initialize(clientName: string, clientVersion: string): Promise<any> {
    return this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: clientName, version: clientVersion }
    })
  }

  async newSession(cwd: string, mcpServers: any[] = []): Promise<any> {
    const result = await this.request('session/new', { cwd, mcpServers })
    this.sessionId = result.sessionId
    return result
  }

  async loadSession(cwd: string, sessionId: string, mcpServers: any[] = []): Promise<any> {
    const result = await this.request('session/load', { sessionId, cwd, mcpServers })
    this.sessionId = sessionId
    return result
  }

  async prompt(parts: any[]): Promise<any> {
    if (!this.sessionId) throw new Error('No active session')
    return this.request('session/prompt', {
      sessionId: this.sessionId,
      prompt: parts
    })
  }

  async setModel(modelId: string): Promise<any> {
    if (!this.sessionId) throw new Error('No active session')
    return this.request('session/set_model', { sessionId: this.sessionId, modelId })
  }

  cancel(): void {
    if (!this.sessionId) return
    this.notify('session/cancel', { sessionId: this.sessionId })
  }
}
