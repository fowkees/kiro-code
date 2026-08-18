import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { WebContents } from 'electron'

export const BROWSER_MCP_PORT = 47893
export const BROWSER_MCP_NAME = 'browser'

let consoleLog: { level: string; message: string }[] = []
let onNavigate: ((url: string) => void) | null = null
let execHandler: ((action: string, params: any) => Promise<any>) | null = null

export function setConsoleSource(webContents: WebContents): void {
  consoleLog = []
  webContents.on('console-message', (_e, level, message) => {
    const levelName = ['debug', 'log', 'warning', 'error'][level] ?? 'log'
    consoleLog.push({ level: levelName, message })
    if (consoleLog.length > 200) consoleLog.shift()
  })
}

export function setBrowserExecHandler(handler: (action: string, params: any) => Promise<any>): void {
  execHandler = handler
}

export function onBrowserNavigate(cb: (url: string) => void): void {
  onNavigate = cb
}

function requireExec() {
  if (!execHandler) throw new Error('O painel de navegador ainda não está pronto.')
  return execHandler
}

function buildMcpServer(): McpServer {
  const mcp = new McpServer({ name: 'kiro-code-browser', version: '0.2.0' })

  mcp.registerTool(
    'navigate',
    {
      description: 'Navigate the embedded browser panel to a URL. Shows the panel to the user if hidden.',
      inputSchema: { url: z.string().describe('The URL to navigate to (include http:// or https://)') }
    },
    async ({ url }) => {
      const exec = requireExec()
      const fullUrl = /^https?:\/\//.test(url) ? url : `http://${url}`
      onNavigate?.(fullUrl)
      const result = await exec('navigate', { url: fullUrl })
      if (result?.error) return { content: [{ type: 'text', text: `Erro ao navegar: ${result.error}` }], isError: true }
      return { content: [{ type: 'text', text: `Navegou para ${fullUrl}` }] }
    }
  )

  mcp.registerTool(
    'screenshot',
    {
      description: 'Take a screenshot of the current page in the embedded browser panel.',
      inputSchema: {}
    },
    async () => {
      const exec = requireExec()
      const result = await exec('screenshot', {})
      if (result?.error) return { content: [{ type: 'text', text: `Erro: ${result.error}` }], isError: true }
      return { content: [{ type: 'image', data: result.data, mimeType: 'image/png' }] }
    }
  )

  mcp.registerTool(
    'get_page_text',
    {
      description: 'Get the visible text content of the current page in the embedded browser panel.',
      inputSchema: {}
    },
    async () => {
      const exec = requireExec()
      const result = await exec('get_page_text', {})
      if (result?.error) return { content: [{ type: 'text', text: `Erro: ${result.error}` }], isError: true }
      return { content: [{ type: 'text', text: String(result.text ?? '').slice(0, 20000) }] }
    }
  )

  mcp.registerTool(
    'click',
    {
      description: 'Click at specific pixel coordinates (relative to the page viewport) in the embedded browser panel.',
      inputSchema: { x: z.number(), y: z.number() }
    },
    async ({ x, y }) => {
      const exec = requireExec()
      const result = await exec('click', { x, y })
      if (result?.error) return { content: [{ type: 'text', text: `Erro: ${result.error}` }], isError: true }
      return { content: [{ type: 'text', text: `Clicou em (${x}, ${y})` }] }
    }
  )

  mcp.registerTool(
    'read_console',
    {
      description: 'Read recent browser console messages (log, warning, error) from the embedded browser panel.',
      inputSchema: {}
    },
    async () => {
      const text = consoleLog.length
        ? consoleLog.map((l) => `[${l.level}] ${l.message}`).join('\n')
        : '(nenhuma mensagem de console registrada)'
      return { content: [{ type: 'text', text: text.slice(0, 10000) }] }
    }
  )

  return mcp
}

export function startBrowserMcpServer(): void {
  const app = express()
  app.use(express.json())

  app.post('/mcp', async (req, res) => {
    const mcp = buildMcpServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => transport.close())
    await mcp.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  app.listen(BROWSER_MCP_PORT, '127.0.0.1')
}

export function getBrowserMcpServerConfig() {
  return {
    type: 'http' as const,
    name: BROWSER_MCP_NAME,
    url: `http://127.0.0.1:${BROWSER_MCP_PORT}/mcp`,
    headers: [] as { name: string; value: string }[]
  }
}
