import type { JsonValue } from '@pkgs/sim';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { mutationStatus } from '../../mutations/client/mutation-status';
import { isClosedDatabaseError } from '../invariants';
import type { SimClient } from '../sim-client';
import { checkDomainInSync } from '../wait-for-in-sync';
import type { SyncSim } from './system';

export function clientIds(s: SyncSim): string[] {
  return [...s.clients.keys()].sort();
}

export function pending(s: SyncSim): number {
  return s.pendingEventCount();
}

/** Spelled-out alias of {@link pending} for scripted reads. */
export const pendingEventCount = pending;

export function schedulerQuiescent(s: SyncSim): boolean {
  return s.isSchedulerQuiescent();
}

export function quiet(s: SyncSim): boolean {
  return s.isSchedulerQuiescent() && s.pendingEventCount() === 0;
}

export function caps(s: SyncSim): string[] {
  return [...s.session.caps] as string[];
}

export function partitioned(s: SyncSim): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

export function clock(s: SyncSim): number {
  return s.session.ports.clock.now();
}

export async function invariantViolations(s: SyncSim): Promise<string[]> {
  try {
    const inv = await s.runtime.kit.checkInvariants();
    if (inv === null) return [];
    return [`${inv.invariant}: ${inv.detail}`];
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
}

/** Pure domain agreement check — never heals or advances time. */
export async function inSync(s: SyncSim): Promise<boolean> {
  try {
    const v = await checkDomainInSync({
      clients: s.clients,
      server: s.server,
      domain: s.runtime.app.pack,
    });
    return v === null;
  } catch (e) {
    if (isClosedDatabaseError(e)) return false;
    throw e;
  }
}

export function restoreNetworkWeight(s: SyncSim): number {
  return partitioned(s).length > 0 ? 1 : 0;
}

/** `'server'` or a client id → that node's SQL handle (null when gone). */
function dbFor(s: SyncSim, nodeId: string): SqlClient | null {
  if (nodeId === 'server') return s.server.db;
  return s.clients.get(nodeId)?.db ?? null;
}

function clientFor(s: SyncSim, clientId: string): SimClient | null {
  return s.clients.get(clientId) ?? null;
}

/** Upload verdict for a queued mutation — null while still pending. */
export async function outcome(
  s: SyncSim,
  clientId: string,
  mutationId: string
): Promise<'confirmed' | 'rejected' | null> {
  const client = clientFor(s, clientId);
  if (client === null) return null;
  const status = await mutationStatus(client.db, mutationId);
  return status === 'pending' ? null : status;
}

export type RejectionRow = {
  readonly id: string;
  readonly mutationId: string;
  readonly code: string;
  readonly message: string;
};

/** Unacknowledged write rejections stored on a client. */
export async function rejections(
  s: SyncSim,
  clientId: string
): Promise<RejectionRow[]> {
  const client = clientFor(s, clientId);
  if (client === null) return [];
  const found = await client.rejections();
  return found.map((r) => ({
    id: r.id,
    mutationId: r.mutationId,
    code: r.code,
    message: r.message,
  }));
}

/** Live pubsub handler topics for a client. */
export function subscribedTopics(s: SyncSim, clientId: string): string[] {
  return [...(clientFor(s, clientId)?.subscribedTopics() ?? [])].sort();
}

/** createPubSub invocations (bootstrap + each remake) for a client. */
export function pubsubRemakeCount(s: SyncSim, clientId: string): number {
  return clientFor(s, clientId)?.pubsubRemakeCount() ?? 0;
}

/**
 * Live connections an app opens to start with: the client builds one, and
 * attaching live updates remakes it once on the first bind.
 */
const OPENING_LIVE_CONNECTIONS = 2;

/**
 * Times the app has remade its live connection since it opened (0 while it
 * has stayed connected throughout; a restart opens a new app).
 */
export function liveReconnects(s: SyncSim, clientId: string): number {
  return Math.max(0, pubsubRemakeCount(s, clientId) - OPENING_LIVE_CONNECTIONS);
}

/** Sync status connection string for a client. */
export function connection(s: SyncSim, clientId: string): string | null {
  return clientFor(s, clientId)?.connection() ?? null;
}

/** Last sync error surfaced on a client's status snapshot. */
export function lastError(s: SyncSim, clientId: string): string | null {
  return clientFor(s, clientId)?.lastError() ?? null;
}

/** True once a client has completed at least one hydrate. */
export function hasSynced(s: SyncSim, clientId: string): boolean {
  return clientFor(s, clientId)?.hasSynced() ?? false;
}

/** True while `nodeId`'s `traffic` edge is held. */
export function netHeld(
  s: SyncSim,
  nodeId: string,
  traffic: 'sync' | 'live' | 'all'
): boolean {
  return s.kit.network.isHeld(nodeId, traffic);
}

/** Skew-adjusted wall time seen by one node. */
export function nodeNow(s: SyncSim, nodeId: string): number {
  return s.node(nodeId).now();
}

/**
 * Rows from an out-of-band read against one node's database. `label` names the
 * call site so memo keys stay stable across restarts of the same query shape.
 */
export async function rows(
  s: SyncSim,
  _label: string,
  nodeId: string,
  statement: Parameters<SqlClient['query']>[0]
): Promise<JsonValue[]> {
  const db = dbFor(s, nodeId);
  if (db === null) return [];
  return (await db.query(statement)) as JsonValue[];
}

/**
 * Ids of the edits a client has queued and not yet heard back about, oldest
 * first (`null` when the client is not running).
 */
export async function queuedEdits(
  s: SyncSim,
  clientId: string
): Promise<string[] | null> {
  const client = clientFor(s, clientId);
  if (client === null) return null;
  const found = await client.db.query(sql<{ id: string }>`
    SELECT id FROM sync_engine_mutations
    WHERE deleted_at IS NULL
    ORDER BY seq ASC
  `);
  return found.map((row) => row.id);
}

/** Install identity for a client — distinct per device, stable across restart. */
export function deviceId(s: SyncSim, clientId: string): string | null {
  return clientFor(s, clientId)?.deviceId ?? null;
}

/** Actor id for a live client. */
export function actorId(s: SyncSim, clientId: string): string | null {
  return clientFor(s, clientId)?.actorId ?? null;
}

/** Settled response of the last {@link postMutations} pin on a client. */
export function postOutcome(s: SyncSim, clientId: string): JsonValue {
  return (s.runtime.lastPost.get(clientId) as JsonValue | undefined) ?? null;
}

/** Mutation id returned by the last {@link mutate} pin on this client. */
export function lastMutationId(s: SyncSim, clientId: string): string | null {
  return s.runtime.lastMutation.get(clientId)?.mutationId ?? null;
}

/** Local-apply failure codes from the last {@link mutate} pin on a client. */
export function lastMutationFailures(s: SyncSim, clientId: string): string[] {
  return (s.runtime.lastMutation.get(clientId)?.failures ?? []).map(
    (f) => f.code
  );
}

/** True once this client's last mutate call has returned (see `startMutate`). */
export function lastMutationSettled(s: SyncSim, clientId: string): boolean {
  return s.runtime.lastMutation.has(clientId);
}

/** True when the last {@link mutate} pin on this client applied locally. */
export function lastMutationOk(s: SyncSim, clientId: string): boolean {
  return s.runtime.lastMutation.get(clientId)?.ok ?? false;
}
