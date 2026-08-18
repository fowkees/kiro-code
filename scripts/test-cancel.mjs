import { spawn } from 'node:child_process'
const cwd = 'C:/Users/guilherme/projects/kiro'
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
    try { msg = JSON.parse(line) } catch { continue }
    if (msg.id !== undefined && msg.method === undefined) {
      console.log('[response]', JSON.stringify(msg).slice(0, 300))
      const p = pending.get(msg.id); if (p) { pending.delete(msg.id); p(msg) }
    } else if (msg.method) {
      console.log('[notif]', msg.method, JSON.stringify(msg.params).slice(0, 200))
    }
  }
})
proc.stderr.on('data', d => console.log('[stderr]', d.toString().slice(0,300)))
proc.on('exit', (c,s) => { console.log('[exit]', c, s); process.exit(0) })
function send(method, params, isNotification) {
  const msg = isNotification ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: nextId++, method, params }
  proc.stdin.write(JSON.stringify(msg) + '\n')
  if (isNotification) return Promise.resolve()
  return new Promise((resolve) => { pending.set(msg.id, resolve) })
}
async function main() {
  await send('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }, clientInfo: { name: 't', version: '0.0.1' } })
  const s = await send('session/new', { cwd, mcpServers: [] })
  const sessionId = s.result.sessionId
  console.log('[info] sending long prompt')
  const promptPromise = send('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Conte muito devagar uma historia bem longa de 500 palavras sobre um gato' }] })
  setTimeout(async () => {
    console.log('[info] sending session/cancel notification')
    await send('session/cancel', { sessionId }, true)
  }, 1500)
  const r = await promptPromise
  console.log('[final result]', JSON.stringify(r))
  proc.kill(); process.exit(0)
}
main().catch(e => { console.error('[error]', e); process.exit(1) })
setTimeout(() => { console.log('[timeout]'); proc.kill(); process.exit(1) }, 20000)
