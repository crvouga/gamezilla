import { defineSurface, type JsonValue, observe } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { mutationStatus } from '../../mutations/client/mutation-status';
import type { SimClientHandle } from '../client-handle';
import { isClosedDatabaseError } from '../invariants';
import { checkDomainConverged } from '../kit-converge';
import type { SyncSurface } from './system';

const { defineObservation } = defineSurface<SyncSurface>();

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => [...s.clients.keys()].sort(),
});

export const pending = defineObservation({
  name: 'pending',
  observe: (s) => s.pendingEventCount(),
});

/** Spelled-out alias of {@link pending} for scripted reads. */
export const pendingEventCount = pending;

export const schedulerQuiescent = defineObservation({
  name: 'schedulerQuiescent',
  observe: (s) => s.isSchedulerQuiescent(),
});

export const quiet = defineObservation({
  name: 'quiet',
  observe: (s) => s.isSchedulerQuiescent() && s.pendingEventCount() === 0,
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s) =>
    s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const clock = defineObservation({
  name: 'clock',
  observe: (s) => s.session.ports.clock.now(),
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s) => {
    try {
      await s.checkInvariants();
      return [] as string[];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
});

/** Pure domain agreement check — never heals or advances time. */
export const converged = defineObservation({
  name: 'converged',
  observe: async (s) => {
    try {
      const v = await checkDomainConverged({
        clients: s.clients,
        server: s.server,
        domain: s.runtime.app.pack,
      });
      return v === null;
    } catch (e) {
      if (isClosedDatabaseError(e)) return false;
      throw e;
    }
  },
});

export const healWeight = defineObservation({
  name: 'healWeight',
  *observe() {
    const cut = yield* partitioned;
    return cut.length > 0 ? 1 : 0;
  },
});

/** `'server'` or a client id → that node's SQL handle (null when gone). */
function dbFor(s: SyncSurface, nodeId: string): SqlClient | null {
  if (nodeId === 'server') return s.server.db;
  return s.clients.get(nodeId)?.db ?? null;
}

function clientFor(s: SyncSurface, clientId: string): SimClientHandle | null {
  return s.clients.get(clientId) ?? null;
}

export type LiveNoteRow = {
  readonly body: string;
  readonly title: string;
  readonly deletedAt: string | null;
};

/**
 * Note row on `nodeId` (`'server'` or a client id). `null` means the row is
 * absent; a non-null `deletedAt` means present but tombstoned.
 */
export const liveNote = defineObservation({
  name: 'liveNote',
  observe: async (s, nodeId: string, id: string): Promise<LiveNoteRow | null> => {
    const db = dbFor(s, nodeId);
    if (db === null) return null;
    const rows = await db.query(sql<LiveNoteRow>`
      SELECT body, title, deleted_at AS "deletedAt"
      FROM notes
      WHERE id = ${id}
    `);
    return rows[0] ?? null;
  },
});

export type LiveSpaceRow = {
  readonly title: string;
  readonly ownerId: string;
  readonly deletedAt: string | null;
};

/** Space row on `nodeId` — same absent / tombstoned rules as {@link liveNote}. */
export const liveSpace = defineObservation({
  name: 'liveSpace',
  observe: async (
    s,
    nodeId: string,
    id: string
  ): Promise<LiveSpaceRow | null> => {
    const db = dbFor(s, nodeId);
    if (db === null) return null;
    const rows = await db.query(sql<LiveSpaceRow>`
      SELECT title, owner_id AS "ownerId", deleted_at AS "deletedAt"
      FROM spaces
      WHERE id = ${id}
    `);
    return rows[0] ?? null;
  },
});

/** Upload verdict for a queued mutation — null while still pending. */
export const outcome = defineObservation({
  name: 'outcome',
  observe: async (
    s,
    clientId: string,
    mutationId: string
  ): Promise<'confirmed' | 'rejected' | null> => {
    const client = clientFor(s, clientId);
    if (client === null) return null;
    const status = await mutationStatus(client.db, mutationId);
    return status === 'pending' ? null : status;
  },
});

export type RejectionRow = {
  readonly id: string;
  readonly mutationId: string;
  readonly code: string;
  readonly message: string;
};

/** Unacknowledged write rejections stored on a client. */
export const rejections = defineObservation({
  name: 'rejections',
  observe: async (s, clientId: string): Promise<RejectionRow[]> => {
    const client = clientFor(s, clientId);
    if (client === null) return [];
    const rows = await client.rejections();
    return rows.map((r) => ({
      id: r.id,
      mutationId: r.mutationId,
      code: r.code,
      message: r.message,
    }));
  },
});

/** Live pubsub handler topics for a client. */
export const subscribedTopics = defineObservation({
  name: 'subscribedTopics',
  observe: (s, clientId: string): string[] =>
    [...(clientFor(s, clientId)?.subscribedTopics() ?? [])].sort(),
});

/** createPubSub invocations (bootstrap + each remake) for a client. */
export const pubsubRemakeCount = defineObservation({
  name: 'pubsubRemakeCount',
  observe: (s, clientId: string): number =>
    clientFor(s, clientId)?.pubsubRemakeCount() ?? 0,
});

/** Sync status connection string for a client. */
export const connection = defineObservation({
  name: 'connection',
  observe: (s, clientId: string): string | null =>
    clientFor(s, clientId)?.connection() ?? null,
});

/** Last sync error surfaced on a client's status snapshot. */
export const lastError = defineObservation({
  name: 'lastError',
  observe: (s, clientId: string): string | null =>
    clientFor(s, clientId)?.lastError() ?? null,
});

/** True once a client has completed at least one hydrate. */
export const hasSynced = defineObservation({
  name: 'hasSynced',
  observe: (s, clientId: string): boolean =>
    clientFor(s, clientId)?.hasSynced() ?? false,
});

/** True while `nodeId`'s `traffic` edge is held. */
export const netHeld = defineObservation({
  name: 'netHeld',
  observe: (s, nodeId: string, traffic: 'sync' | 'live' | 'all'): boolean =>
    s.kit.network.isHeld(nodeId, traffic),
});

/** Skew-adjusted wall time seen by one node. */
export const nodeNow = defineObservation({
  name: 'nodeNow',
  observe: (s, nodeId: string): number => s.node(nodeId).now(),
});

/**
 * Rows from an out-of-band read against one node's database. `label` names the
 * call site so memo keys stay stable across restarts of the same query shape.
 */
export const rows = defineObservation({
  name: 'rows',
  observe: async (
    s,
    _label: string,
    nodeId: string,
    statement: Parameters<SqlClient['query']>[0]
  ): Promise<JsonValue[]> => {
    const db = dbFor(s, nodeId);
    if (db === null) return [];
    return (await db.query(statement)) as JsonValue[];
  },
});

/** Install identity for a client — distinct per device, stable across restart. */
export const deviceId = defineObservation({
  name: 'deviceId',
  observe: (s, clientId: string): string | null =>
    clientFor(s, clientId)?.deviceId ?? null,
});

/** Actor id for a live client. */
export const actorId = defineObservation({
  name: 'actorId',
  observe: (s, clientId: string): string | null =>
    clientFor(s, clientId)?.actorId ?? null,
});

/** Settled response of the last {@link postMutations} pin on a client. */
export const postOutcome = defineObservation({
  name: 'postOutcome',
  observe: (s, clientId: string): JsonValue =>
    (s.runtime.lastPost.get(clientId) as JsonValue | undefined) ?? null,
});

/** Mutation id returned by the last {@link mutate} pin on this client. */
export const lastMutationId = defineObservation({
  name: 'lastMutationId',
  observe: (s, clientId: string): string | null =>
    s.runtime.lastMutation.get(clientId)?.mutationId ?? null,
});

/** Local-apply failure codes from the last {@link mutate} pin on a client. */
export const lastMutationFailures = defineObservation({
  name: 'lastMutationFailures',
  observe: (s, clientId: string): string[] =>
    (s.runtime.lastMutation.get(clientId)?.failures ?? []).map((f) => f.code),
});

/** True when the last {@link mutate} pin on this client applied locally. */
export const lastMutationOk = defineObservation({
  name: 'lastMutationOk',
  observe: (s, clientId: string): boolean =>
    s.runtime.lastMutation.get(clientId)?.ok ?? false,
});

export { observe };
