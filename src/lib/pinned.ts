const KEY = 'kiro-desktop:pinned-sessions'

export function getPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export function togglePinned(sessionId: string): Set<string> {
  const pinned = getPinned()
  if (pinned.has(sessionId)) pinned.delete(sessionId)
  else pinned.add(sessionId)
  localStorage.setItem(KEY, JSON.stringify([...pinned]))
  return pinned
}
