import { spawn } from 'node:child_process'
const cwd = 'C:/Users/guilherme/Desktop'
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
      console.log('[non-json]', line.slice(0, 200))
      continue
    }
    if (msg.id !== undefined && msg.method === undefined) {
      console.log('[response]', JSON.stringify(msg).slice(0, 500))
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        p(msg)
      }
    } else if (msg.method) {
      console.log('[notif]', msg.method, JSON.stringify(msg.params).slice(0, 300))
    }
  }
})
proc.stderr.on('data', (d) => console.log('[stderr]', d.toString().slice(0, 300)))
proc.on('exit', (c, s) => {
  console.log('[exit]', c, s)
  process.exit(0)
})
function send(method, params) {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}
async function main() {
  await send('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 't', version: '0.0.1' }
  })
  const r = await send('session/load', {
    sessionId: '360ebb9a-8b16-4b94-9d4d-d0f423df6637',
    cwd,
    mcpServers: []
  })
  console.log('[load result]', JSON.stringify(r))
  proc.kill()
  process.exit(0)
}
main().catch((e) => {
  console.error('[error]', e)
  process.exit(1)
})
setTimeout(() => {
  console.log('[timeout]')
  proc.kill()
  process.exit(1)
}, 15000)
