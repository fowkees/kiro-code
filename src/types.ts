export interface Attachment {
  id: string
  name: string
  kind: 'image' | 'text'
  mimeType?: string
  data?: string
  text?: string
}

export type Block =
  | { kind: 'user'; id: string; text: string; attachments?: Attachment[] }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'thought'; id: string; text: string }
  | {
      kind: 'tool'
      id: string
      toolCallId: string
      title: string
      status: 'pending' | 'in_progress' | 'completed' | 'failed'
      contentText: string
    }

export interface PermissionRequest {
  id: number
  title: string
  options: { optionId: string; name: string; kind: string }[]
}

export interface ModelInfo {
  modelId: string
  name: string
  description?: string
}

export interface SessionSummary {
  sessionId: string
  cwd: string
  title: string
  createdAt: string
  updatedAt: string
}
