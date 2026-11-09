/**
 * The writes a person was told were saved, and the checks that each one
 * ends up applied exactly once or visibly refused — never lost, never
 * doubled, never dropped without a word.
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { liveNotes } from './reads';
import type { SyncHarness } from './scenario-system';
import {
  clientIds,
  connection,
  hasSynced,
  lastError,
  queuedEdits,
  rejections,
} from './sync-observations';

/** One write the device accepted locally (the person saw it saved). */
export type LedgerWrite = {
  readonly clientId: string;
  readonly mutationId: string;
  readonly noteId: string;
  /** Unique text the write appends; counted on the server to spot doubles. */
  readonly piece: string;
  /** The server is expected to refuse this write. */
  readonly refusable: boolean;
};

type AppliedRow = { readonly mutation_id: string; readonly status: string };

/** Server idempotency markers: mutation id → `applied` / `rejected`. */
export async function serverAppliedMarkers(
  s: SyncHarness
): Promise<[string, string][]> {
  const found = await s.server.db.query(sql<AppliedRow>`
    SELECT mutation_id, status FROM sync_engine_mutations_applied
    ORDER BY mutation_id ASC
  `);
  return found.map((row) => [row.mutation_id, row.status]);
}

async function appliedMarkers(
  s: Run<SyncHarness>
): Promise<Map<string, string>> {
  return new Map(await s.read(serverAppliedMarkers));
}

function occurrences(body: string, piece: string): number {
  return body.split(piece).length - 1;
}

async function refusedOnDevice(
  s: Run<SyncHarness>,
  writes: readonly LedgerWrite[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = new Set(writes.map((w) => w.clientId));
  for (const id of [...ids].sort()) {
    for (const r of await s.read(rejections, id)) out.add(r.mutationId);
  }
  return out;
}

function writeViolation(
  w: LedgerWrite,
  marker: string | undefined,
  copies: number,
  refused: boolean
): string | null {
  const label = `${w.clientId} ${w.mutationId} (${w.piece})`;
  if (copies > 1) return `applied ${copies} times: ${label}`;
  if (marker === 'applied' && copies !== 1) {
    return `applied but missing on the server: ${label}`;
  }
  if (marker === 'applied' && refused) {
    return `refused on the device though the server applied it: ${label}`;
  }
  if (marker !== 'applied' && copies > 0) {
    return `on the server without being applied: ${label}`;
  }
  if (marker === 'rejected' && !refused) {
    return `refusal never surfaced on the device: ${label}`;
  }
  if (marker === undefined && !refused) {
    return `lost: neither applied nor refused: ${label}`;
  }
  return null;
}

/**
 * Every ledger write is applied exactly once or refused on its device, and
 * no device still holds a write it never heard back about.
 */
export async function ledgerViolations(
  s: Run<SyncHarness>,
  writes: readonly LedgerWrite[]
): Promise<string[]> {
  const markers = await appliedMarkers(s);
  const bodies = new Map(
    (await s.read(liveNotes, 'server')).map((n) => [n.id, n.body])
  );
  const refused = await refusedOnDevice(s, writes);
  const out: string[] = [];
  for (const w of writes) {
    const v = writeViolation(
      w,
      markers.get(w.mutationId),
      occurrences(bodies.get(w.noteId) ?? '', w.piece),
      refused.has(w.mutationId)
    );
    if (v !== null) out.push(v);
  }
  for (const id of await s.read(clientIds)) {
    const queued = (await s.read(queuedEdits, id)) ?? [];
    if (queued.length > 0)
      out.push(`${id} still holds ${queued.length} unsent`);
  }
  return out;
}

const CONNECTIONS = new Set([
  'disconnected',
  'connecting',
  'connected',
  'syncing',
]);

/** The sync status the UI renders is always a well-formed value. */
export async function statusViolations(s: Run<SyncHarness>): Promise<string[]> {
  const out: string[] = [];
  for (const id of await s.read(clientIds)) {
    const conn = await s.read(connection, id);
    if (conn === null || !CONNECTIONS.has(conn)) {
      out.push(`${id} connection status ${String(conn)}`);
    }
    if (typeof (await s.read(hasSynced, id)) !== 'boolean') {
      out.push(`${id} hasSynced undefined`);
    }
    const error = await s.read(lastError, id);
    if (error !== null && typeof error !== 'string') {
      out.push(`${id} lastError ${String(error)}`);
    }
  }
  return out;
}
