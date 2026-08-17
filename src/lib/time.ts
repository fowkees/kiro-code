export function dayGroup(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)

  if (diffDays <= 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays <= 7) return 'Últimos 7 dias'
  return 'Mais antigas'
}

export function shortTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function folderName(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
}
