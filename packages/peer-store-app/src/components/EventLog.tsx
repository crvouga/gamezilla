import type { Event } from '@gamezilla/peer-store/types'

export function EventLog({ events }: { events: Event[] }) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-5">
      <h4 className="mb-2 text-sm font-bold text-white/40 uppercase">
        Committed Events
      </h4>
      {events.length === 0 && (
        <p className="text-xs text-white/20">No committed events yet.</p>
      )}
      {events.map((event, i) => {
        const payload = event.payload as Record<string, unknown> | undefined
        return (
          <div
            key={i}
            className="flex items-baseline gap-3 text-xs font-mono"
          >
            <span className="w-5 shrink-0 text-right text-white/20">
              {i + 1}
            </span>
            <span className="font-semibold text-emerald-300">
              {event.type}
            </span>
            {payload && (
              <span className="truncate text-white/35">
                {JSON.stringify(payload)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
