import type { State } from '@gamezilla/peer-store/types'
import { useState } from 'react'

export function StateInspector({
  committedState,
  displayState,
}: {
  committedState: State
  displayState: State
}) {
  const [expanded, setExpanded] = useState(false)
  const has_diff = JSON.stringify(committedState) !== JSON.stringify(displayState)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-left text-xs text-white/30 hover:text-white/50"
      >
        {has_diff ? '▸ state (differs)' : '▸ state'}
      </button>
    )
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="mb-1.5 text-white/30 hover:text-white/50"
      >
        ▾ state
      </button>
      <DiffView committed={committedState} display={displayState} />
    </div>
  )
}

function DiffView({
  committed,
  display,
}: {
  committed: State
  display: State
}) {
  const all_keys = new Set([
    ...Object.keys(committed),
    ...Object.keys(display),
  ])

  return (
    <div className="space-y-0.5 font-mono">
      {[...all_keys].map((key) => {
        const c_val = JSON.stringify(committed[key])
        const d_val = JSON.stringify(display[key])
        const is_same = c_val === d_val

        if (is_same) {
          return (
            <div key={key} className="text-emerald-300/50">
              {key}: {c_val}
            </div>
          )
        }

        return (
          <div key={key}>
            <div className="text-red-300/60 line-through">
              {key}: {c_val}
            </div>
            <div className="text-amber-300/80">
              {key}: {d_val}
            </div>
          </div>
        )
      })}
    </div>
  )
}
