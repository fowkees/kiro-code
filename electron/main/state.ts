import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AppSettings {
  accentColor: string
  defaultFolder: string | null
  browserAutoApprove: boolean
  fontSize: 'small' | 'medium' | 'large'
}

const DEFAULT_SETTINGS: AppSettings = {
  accentColor: '#b03dfd',
  defaultFolder: null,
  browserAutoApprove: true,
  fontSize: 'medium'
}

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

function readState(): any {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8'))
  } catch {
    return {}
  }
}

function writeState(patch: Record<string, unknown>): void {
  try {
    const data = { ...readState(), ...patch }
    writeFileSync(statePath(), JSON.stringify(data, null, 2), 'utf8')
  } catch {
    // best-effort persistence, safe to ignore
  }
}

export function getLastFolder(): string | null {
  const data = readState()
  return typeof data.lastFolder === 'string' ? data.lastFolder : null
}

export function setLastFolder(folder: string): void {
  writeState({ lastFolder: folder })
}

export function getSettings(): AppSettings {
  const data = readState()
  return { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) }
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial }
  writeState({ settings: next })
  return next
}
