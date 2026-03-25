import type { Snapshot } from './types';

export function Inspector({
  selectedKey,
  snapshot,
  onClose,
}: {
  selectedKey: string | null;
  snapshot: Snapshot | null;
  title: string;
  onClose: () => void;
}) {
  if (!selectedKey || !snapshot) return null;

  const isSrv = selectedKey.startsWith('s:'),
    id = selectedKey.slice(2);
  const actor = isSrv
    ? snapshot.servers.find((s) => s.id === id)
    : snapshot.clients.find((c) => c.id === id);
  if (!actor) return null;

  const rows = actor.rows || [];
  const client = !isSrv ? snapshot.clients.find((c) => c.id === id) : null;

  return (
    <div
      className="absolute bottom-0 right-0 top-0 z-30 flex w-full max-w-sm flex-col border-l border-neutral-800 bg-neutral-950/97 shadow-2xl backdrop-blur-md sm:w-[340px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 border-b border-neutral-800 px-3 py-2.5">
        <div>
          <div className="text-sm font-semibold text-neutral-100">
            <span className="text-neutral-500">{isSrv ? 'server' : 'client'}:</span>
            <span className="font-mono text-blue-400">{id}</span>
          </div>
          {client && (
            <div className="mt-1 text-xs text-neutral-500">
              serverId: <span className="font-mono text-neutral-400">{client.serverId}</span>
              {client.partitioned && (
                <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-red-400">partitioned</span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-neutral-800 px-2 py-1 text-[0.65rem] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
        >
          Esc
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-xs leading-relaxed">
        {client?.lastPoll && (
          <div className="mb-2 rounded border border-emerald-500/20 bg-emerald-950/20 px-2 py-1.5 text-emerald-300/90 text-[0.65rem]">
            remote_read results:{' '}
            {(client.lastPoll.results || [])
              .map((r) => r.entityCount + ' entities \u00b7 ' + r.patchCount + ' patches')
              .join(' \u00b7 ')}
          </div>
        )}

        <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-600">
          Entities ({rows.length})
        </div>

        <ul className="mt-1.5 space-y-1.5">
          {rows.length === 0 && <li className="text-neutral-600">Empty</li>}
          {rows.map((row) => (
            <li key={row.entityId} className="rounded border border-neutral-800/60 bg-neutral-900/60 px-2 py-1.5">
              <div className="font-mono text-[0.65rem] text-amber-300/80">
                {row.entityId.length > 14 ? row.entityId.slice(0, 12) + '\u2026' : row.entityId}
              </div>
              <div className="text-[0.6rem] text-neutral-600">{row.entityType}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.attrs.slice(0, 12).map((a) => {
                  const s = a.includes('/') ? a.slice(a.lastIndexOf('/') + 1) : a;
                  return (
                    <span key={a} className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[0.5rem] text-neutral-400" title={a}>
                      {s}
                    </span>
                  );
                })}
                {row.attrs.length > 12 && <span className="text-neutral-600">+{row.attrs.length - 12}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
