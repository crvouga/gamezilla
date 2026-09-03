import { defineObservation, type JsonValue, observe } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { mutationStatus } from '../../mutations/client/mutation-status';
import type { SimClientHandle } from '../client-handle';
import { isClosedDatabaseError } from '../invariants';
import { checkDomainConverged } from '../kit-converge';
import type { SyncSurface } from './system';

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s: SyncSurface) => [...s.clients.keys()].sort(),
});

export const pending = defineObservation({
  name: 'pending',
  observe: (s: SyncSurface) => s.pendingEventCount(),
});

/** Spelled-out alias of {@link pending} for scripted reads. */
export const pendingEventCount = pending;

export const schedulerQuiescent = defineObservation({
  name: 'schedulerQuiescent',
  observe: (s: SyncSurface) => s.isSchedulerQuiescent(),
});

export const quiet = defineObservation({
  name: 'quiet',
  observe: (s: SyncSurface) =>
    s.isSchedulerQuiescent() && s.pendingEventCount() === 0,
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s: SyncSurface) => [...s.session.caps] as string[],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s: SyncSurface) =>
    s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const clock = defineObservation({
  name: 'clock',
  observe: (s: SyncSurface) => s.session.ports.clock.now(),
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s: SyncSurface) => {
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
  observe: async (s: SyncSurface) => {
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
export function liveNote(nodeId: string, id: string) {
  return defineObservation({
    name: `liveNote:${nodeId}:${id}`,
    observe: async (s: SyncSurface): Promise<LiveNoteRow | null> => {
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
}

export type LiveSpaceRow = {
  readonly title: string;
  readonly ownerId: string;
  readonly deletedAt: string | null;
};

/** Space row on `nodeId` — same absent / tombstoned rules as {@link liveNote}. */
export function liveSpace(nodeId: string, id: string) {
  return defineObservation({
    name: `liveSpace:${nodeId}:${id}`,
    observe: async (s: SyncSurface): Promise<LiveSpaceRow | null> => {
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
}

/** Upload verdict for a queued mutation — null while still pending. */
export function outcome(clientId: string, mutationId: string) {
  return defineObservation({
    name: `outcome:${clientId}:${mutationId}`,
    observe: async (
      s: SyncSurface
    ): Promise<'confirmed' | 'rejected' | null> => {
      const client = clientFor(s, clientId);
      if (client === null) return null;
      const status = await mutationStatus(client.db, mutationId);
      return status === 'pending' ? null : status;
    },
  });
}

export type RejectionRow = {
  readonly id: string;
  readonly mutationId: string;
  readonly code: string;
  readonly message: string;
};

/** Unacknowledged write rejections stored on a client. */
export function rejections(clientId: string) {
  return defineObservation({
    name: `rejections:${clientId}`,
    observe: async (s: SyncSurface): Promise<RejectionRow[]> => {
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
}

/** Live pubsub handler topics for a client. */
export function subscribedTopics(clientId: string) {
  return defineObservation({
    name: `subscribedTopics:${clientId}`,
    observe: (s: SyncSurface): string[] =>
      [...(clientFor(s, clientId)?.subscribedTopics() ?? [])].sort(),
  });
}

/** createPubSub invocations (bootstrap + each remake) for a client. */
export function pubsubRemakeCount(clientId: string) {
  return defineObservation({
    name: `pubsubRemakeCount:${clientId}`,
    observe: (s: SyncSurface): number =>
      clientFor(s, clientId)?.pubsubRemakeCount() ?? 0,
  });
}

/** Sync status connection string for a client. */
export function connection(clientId: string) {
  return defineObservation({
    name: `connection:${clientId}`,
    observe: (s: SyncSurface): string | null =>
      clientFor(s, clientId)?.connection() ?? null,
  });
}

/** Last sync error surfaced on a client's status snapshot. */
export function lastError(clientId: string) {
  return defineObservation({
    name: `lastError:${clientId}`,
    observe: (s: SyncSurface): string | null =>
      clientFor(s, clientId)?.lastError() ?? null,
  });
}

/** True once a client has completed at least one hydrate. */
export function hasSynced(clientId: string) {
  return defineObservation({
    name: `hasSynced:${clientId}`,
    observe: (s: SyncSurface): boolean =>
      clientFor(s, clientId)?.hasSynced() ?? false,
  });
}

/** True while `nodeId`'s `traffic` edge is held. */
export function netHeld(nodeId: string, traffic: 'sync' | 'live' | 'all') {
  return defineObservation({
    name: `netHeld:${nodeId}:${traffic}`,
    observe: (s: SyncSurface): boolean => s.kit.network.isHeld(nodeId, traffic),
  });
}

/** Skew-adjusted wall time seen by one node. */
export function nodeNow(nodeId: string) {
  return defineObservation({
    name: `nodeNow:${nodeId}`,
    observe: (s: SyncSurface): number => s.node(nodeId).now(),
  });
}

/**
 * Rows from an out-of-band read against one node's database. `label` names the
 * observation, so pick something stable per call site.
 */
export function rows<T extends Record<string, JsonValue>>(
  label: string,
  nodeId: string,
  statement: Parameters<SqlClient['query']>[0]
) {
  return defineObservation({
    name: `rows:${nodeId}:${label}`,
    observe: async (s: SyncSurface): Promise<T[]> => {
      const db = dbFor(s, nodeId);
      if (db === null) return [];
      return (await db.query(statement)) as T[];
    },
  });
}

/** Install identity for a client — distinct per device, stable across restart. */
export function deviceId(clientId: string) {
  return defineObservation({
    name: `deviceId:${clientId}`,
    observe: (s: SyncSurface): string | null =>
      clientFor(s, clientId)?.deviceId ?? null,
  });
}

/** Actor id for a live client. */
export function actorId(clientId: string) {
  return defineObservation({
    name: `actorId:${clientId}`,
    observe: (s: SyncSurface): string | null =>
      clientFor(s, clientId)?.actorId ?? null,
  });
}

/** Settled response of the last {@link postMutations} pin on a client. */
export function postOutcome(clientId: string) {
  return defineObservation({
    name: `postOutcome:${clientId}`,
    observe: (s: SyncSurface): JsonValue =>
      (s.runtime.lastPost.get(clientId) as JsonValue | undefined) ?? null,
  });
}

/** Mutation id returned by the last {@link mutate} pin on this client. */
export function lastMutationId(clientId: string) {
  return defineObservation({
    name: `lastMutationId:${clientId}`,
    observe: (s: SyncSurface): string | null =>
      s.runtime.lastMutation.get(clientId)?.mutationId ?? null,
  });
}

/** Local-apply failure codes from the last {@link mutate} pin on a client. */
export function lastMutationFailures(clientId: string) {
  return defineObservation({
    name: `lastMutationFailures:${clientId}`,
    observe: (s: SyncSurface): string[] =>
      (s.runtime.lastMutation.get(clientId)?.failures ?? []).map((f) => f.code),
  });
}

/** True when the last {@link mutate} pin on this client applied locally. */
export function lastMutationOk(clientId: string) {
  return defineObservation({
    name: `lastMutationOk:${clientId}`,
    observe: (s: SyncSurface): boolean =>
      s.runtime.lastMutation.get(clientId)?.ok ?? false,
  });
}

export { observe };
