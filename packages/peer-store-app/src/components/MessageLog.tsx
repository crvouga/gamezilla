import type { MessageLogEntry } from '../simulator/playground'

const KIND_COLORS: Record<string, string> = {
  command: 'text-sky-300',
  vote: 'text-amber-300',
  commit: 'text-emerald-300',
  timeout: 'text-red-300',
  error: 'text-white/40',
}

export function MessageLog({ entries }: { entries: MessageLogEntry[] }) {
  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-3">
      <h4 className="mb-1 text-[0.65rem] font-bold text-white/40 uppercase">
        Message Log
      </h4>
      {entries.length === 0 && (
        <p className="text-[0.6rem] text-white/20">No messages yet.</p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex items-baseline gap-2 text-[0.6rem] font-mono ${KIND_COLORS[entry.kind] ?? 'text-white/40'}`}
        >
          <span className="w-14 shrink-0 text-white/25">{entry.from}</span>
          <span className="w-12 shrink-0 font-semibold">{entry.kind}</span>
          <span className="truncate text-white/50">{entry.summary}</span>
        </div>
      ))}
    </div>
  )
}
