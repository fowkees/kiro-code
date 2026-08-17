import { useState } from 'react'
import { Block } from '../types'
import { ChevronRightIcon } from './icons'

export default function ToolCallCard({ block }: { block: Extract<Block, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false)
  const hasBody = block.contentText.trim().length > 0

  return (
    <div className="tool-row">
      <button
        className={`tool-row__summary tool-row__summary--${block.status}`}
        onClick={() => hasBody && setOpen((v) => !v)}
      >
        <span className="tool-row__dot" />
        <span className="tool-row__title">{block.title}</span>
        {hasBody && (
          <ChevronRightIcon className={`tool-row__chevron ${open ? 'tool-row__chevron--open' : ''}`} />
        )}
      </button>
      {open && hasBody && <pre className="tool-row__body">{block.contentText}</pre>}
    </div>
  )
}
