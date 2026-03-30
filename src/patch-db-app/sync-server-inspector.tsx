import { assertPatchDbSyncServerBaseUrl } from '@/patch-db/assert-sync-server-base-url';
import type { Patch, PatchesDbResult } from '@/patch-db/interface';
import {
  ADMIN_METRIC_ENTITY_TYPE,
  PatchDbClientTransportHttpFetch,
} from '@/patch-db/transport';
import { useCallback, useEffect, useRef, useState } from 'react';

const URL_STORAGE_KEY = 'patchdb-inspector-sync-url';

function defaultUrlWhenNoStorage(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5001';
}

const DIRECT_SYNC_DEV_URLS = new Set([
  'http://localhost:5001',
  'http://127.0.0.1:5001',
]);

function readStoredUrl(): string {
  try {
    const u = localStorage.getItem(URL_STORAGE_KEY);
    if (typeof u === 'string' && u.length > 0) {
      if (
        import.meta.env.DEV &&
        typeof window !== 'undefined' &&
        DIRECT_SYNC_DEV_URLS.has(u)
      ) {
        return window.location.origin;
      }
      return u;
    }
  } catch {
    /* ignore */
  }
  return defaultUrlWhenNoStorage();
}

function persistUrl(url: string): void {
  try {
    localStorage.setItem(URL_STORAGE_KEY, url);
  } catch {
    /* ignore */
  }
}

function hasExplicitlyStoredUrl(): boolean {
  try {
    const u = localStorage.getItem(URL_STORAGE_KEY);
    return typeof u === 'string' && u.length > 0;
  } catch {
    return false;
  }
}

function tryInitialConnectedUrl(): string | null {
  if (!hasExplicitlyStoredUrl()) return null;
  try {
    const u = readStoredUrl().trim();
    assertPatchDbSyncServerBaseUrl(u);
    return u;
  } catch {
    return null;
  }
}

function formatAttrValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SyncServerInspector() {
  const [urlInput, setUrlInput] = useState(readStoredUrl);
  const [connectedUrl, setConnectedUrl] = useState<string | null>(
    tryInitialConnectedUrl
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatchesDbResult | null>(null);
  const knownPatchesRef = useRef<Patch[]>([]);

  const handleConnect = useCallback(() => {
    const trimmed = urlInput.trim();
    setError(null);
    try {
      assertPatchDbSyncServerBaseUrl(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnectedUrl(null);
      return;
    }
    knownPatchesRef.current = [];
    setResult(null);
    setConnectedUrl(trimmed);
    persistUrl(trimmed);
  }, [urlInput]);

  useEffect(() => {
    if (connectedUrl === null) return;

    const transport = new PatchDbClientTransportHttpFetch(connectedUrl);
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      try {
        const results = await transport.read([
          {
            entityType: ADMIN_METRIC_ENTITY_TYPE,
            knownPatches: knownPatchesRef.current,
          },
        ]);
        if (cancelled) return;
        const first = results[0];
        if (first !== null && first !== undefined) {
          knownPatchesRef.current = first.patches;
          setResult(first);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    const unsub = transport.subscribe(() => {
      void refresh();
    });
    void refresh();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [connectedUrl]);

  const entity = result?.entities[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 text-white">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-white/50">
            Sync server URL
          </span>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConnect();
            }}
            placeholder="https://…"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white/90 outline-none ring-violet-500/40 focus:border-violet-500/50 focus:ring-2"
          />
        </label>
        <button
          type="button"
          onClick={handleConnect}
          className="rounded-lg border border-teal-500/40 bg-teal-950/40 px-4 py-2 text-sm font-semibold text-teal-200 transition-colors hover:bg-teal-900/50"
        >
          Connect
        </button>
      </div>

      {error !== null ? (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {entity !== null && entity !== undefined ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                <th className="px-4 py-2 font-medium">Attribute</th>
                <th className="px-4 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(entity.attributes)
                .filter(([k]) => k.startsWith('admin/'))
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <tr
                    key={key}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-violet-200/90">
                      {key}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-white/80">
                      {formatAttrValue(value)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="border-t border-white/10 px-4 py-2 text-[0.65rem] text-white/40">
            entity {entity.entityId} · {entity.entityType} · patches in result:{' '}
            {result?.patches.length ?? 0}
          </p>
        </div>
      ) : connectedUrl !== null && error === null ? (
        <div className="flex items-center gap-2 text-sm text-white/55">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-violet-400" />
          Waiting for metrics from server…
        </div>
      ) : null}
    </div>
  );
}
