import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

export function getLastFolder(): string | null {
  try {
    const data = JSON.parse(readFileSync(statePath(), 'utf8'))
    return typeof data.lastFolder === 'string' ? data.lastFolder : null
  } catch {
    return null
  }
}

export function setLastFolder(folder: string): void {
  try {
    writeFileSync(statePath(), JSON.stringify({ lastFolder: folder }), 'utf8')
  } catch {
    // best-effort persistence, safe to ignore
  }
}
