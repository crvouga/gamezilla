import { useState } from 'react'
import { PlaygroundPage } from './pages/PlaygroundPage'

type Mode = 'playground' | 'docs'

export function App() {
  const [mode, setMode] = useState<Mode>('playground')

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-(--pg-bg) text-white">
      <nav className="flex shrink-0 gap-1 border-b border-white/10 bg-black/20 px-4 py-2">
        <NavButton
          active={mode === 'playground'}
          onClick={() => setMode('playground')}
        >
          Playground
        </NavButton>
        <NavButton
          active={mode === 'docs'}
          onClick={() => setMode('docs')}
        >
          Docs
        </NavButton>
      </nav>
      {mode === 'playground' ? (
        <PlaygroundPage />
      ) : (
        <div className="flex flex-1 items-center justify-center text-white/40">
          <p className="text-sm">Documentation coming soon.</p>
        </div>
      )}
    </div>
  )
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white'
          : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-white/45 transition-colors hover:bg-white/8 hover:text-white/75'
      }
    >
      {children}
    </button>
  )
}
