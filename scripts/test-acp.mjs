import { spawn } from 'node:child_process'

const cwd = process.argv[2] || process.cwd()
const proc = spawn('kiro-cli', ['acp'], { cwd, windowsHide: true })

let buffer = ''
let nextId = 1
const pending = new Map()

proc.stdout.setEncoding('utf8')
proc.stdout.on('data', (chunk) => {
  buffer += chunk
  let idx
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim()
    buffer = buffer.slice(idx + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      console.log('[stdout:non-json]', line)
      continue
    }
    if (msg.id !== undefined && msg.method === undefined) {
      console.log('[response]', JSON.stringify(msg).slice(0, 300))
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        p(msg)
      }
    } else if (msg.method) {
      console.log('[notification]', msg.method, JSON.stringify(msg.params).slice(0, 300))
    }
  }
})

proc.stderr.setEncoding('utf8')
proc.stderr.on('data', (chunk) => console.log('[stderr]', chunk))

proc.on('exit', (code, signal) => {
  console.log(`[exit] code=${code} signal=${signal}`)
  process.exit(0)
})

function send(method, params) {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    const msg = { jsonrpc: '2.0', id, method, params }
    console.log('[request]', method)
    proc.stdin.write(JSON.stringify(msg) + '\n')
  })
}

async function main() {
  await send('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'kiro-desktop-test', version: '0.0.1' }
  })
  const sessionResult = await send('session/new', { cwd, mcpServers: [] })
  const sessionId = sessionResult.result.sessionId
  console.log('[info] sessionId =', sessionId)

  console.log('[info] sending prompt now, watching for exit...')
  const promptResult = await send('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: 'responda apenas a palavra: ok' }]
  })
  console.log('[done]', JSON.stringify(promptResult))
  proc.kill()
  process.exit(0)
}

main().catch((err) => {
  console.error('[error]', err)
  process.exit(1)
})

setTimeout(() => {
  console.log('[timeout] killing process after 30s')
  proc.kill()
  process.exit(1)
}, 30000)
