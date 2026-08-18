import { FileCategory } from '../types'

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'html',
  'css',
  'scss',
  'yml',
  'yaml',
  'xml',
  'csv',
  'log',
  'sh',
  'sql',
  'ini',
  'toml',
  'env',
  'gitignore'
])

function extOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

export function isPlainTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(extOf(name))
}

export function getFileCategory(name: string): FileCategory {
  const ext = extOf(name)
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'sheet'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (TEXT_EXTENSIONS.has(ext)) return 'code'
  return 'generic'
}
