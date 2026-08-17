import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const SESSIONS_DIR = join(homedir(), '.kiro', 'sessions', 'cli')

export interface SessionSummary {
  sessionId: string
  cwd: string
  title: string
  createdAt: string
  updatedAt: string
}

export function listSessions(limit = 100): SessionSummary[] {
  let files: string[]
  try {
    files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }

  const sessions: SessionSummary[] = []
  for (const file of files) {
    try {
      const raw = readFileSync(join(SESSIONS_DIR, file), 'utf8')
      const data = JSON.parse(raw)
      if (!data.session_id || !data.cwd) continue

      const transcriptPath = join(SESSIONS_DIR, `${data.session_id}.jsonl`)
      let hasContent = false
      try {
        hasContent = statSync(transcriptPath).size > 0
      } catch {
        hasContent = false
      }
      if (!hasContent) continue

      sessions.push({
        sessionId: data.session_id,
        cwd: data.cwd,
        title: data.title || '(sem título)',
        createdAt: data.created_at,
        updatedAt: data.updated_at ?? data.created_at
      })
    } catch {
      continue
    }
  }

  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return sessions.slice(0, limit)
}

export function deleteSession(sessionId: string): void {
  for (const ext of ['.json', '.jsonl', '.lock']) {
    const path = join(SESSIONS_DIR, `${sessionId}${ext}`)
    if (existsSync(path)) rmSync(path, { force: true })
  }
}

export function renameSession(sessionId: string, title: string): void {
  const path = join(SESSIONS_DIR, `${sessionId}.json`)
  const raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw)
  data.title = title
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
}

export interface TranscriptTurn {
  role: 'user' | 'assistant'
  text: string
}

function extractTextFromContent(content: any[]): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c.kind === 'text')
    .map((c) => c.data)
    .join('')
}

export function readTranscript(sessionId: string): TranscriptTurn[] {
  const path = join(SESSIONS_DIR, `${sessionId}.jsonl`)
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return []
  }

  const turns: TranscriptTurn[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let entry: any
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry.kind === 'Prompt') {
      turns.push({ role: 'user', text: extractTextFromContent(entry.data?.content) })
    } else if (entry.kind === 'AssistantMessage') {
      turns.push({ role: 'assistant', text: extractTextFromContent(entry.data?.content) })
    }
  }
  return turns
}
