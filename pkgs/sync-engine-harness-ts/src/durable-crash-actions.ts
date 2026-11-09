/**
 * Scripted-pin vocabulary for crash-point runs: number a client's durable
 * boundaries, kill it at one, write through it while counting what the
 * person was told, and read what its storage kept.
 */

import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { JsonValue } from '@pkgs/harness-root-shared-ts/json';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { appendedTokens, appendNoteToken } from './append-note-mutation';
import type {
  CrashMoment,
  DurableBoundary,
  DurableCrash,
} from './durable-crash-points';
import { HarnessProcessDied } from './durable-crash-points';
import type { SyncHarness } from './scenario-system';

/** What the person saw when they made one write. */
export type DurableWriteOutcome =
  /** `mutate` resolved ok: the app told the person it was saved. */
  | 'acknowledged'
  /** The app refused it (a validation failure the person was shown). */
  | 'refused'
  /** The process died while the write was in flight. */
  | 'died'
  /** The process was already dead: the person never made it. */
  | 'notMade';

const outcomesByRun = new WeakMap<object, Map<string, DurableWriteOutcome>>();

function outcomes(s: SyncHarness): Map<string, DurableWriteOutcome> {
  let found = outcomesByRun.get(s);
  if (found === undefined) {
    found = new Map();
    outcomesByRun.set(s, found);
  }
  return found;
}

/** Number this client's durable boundaries from its next open. */
export const trackDurableBoundaries = defineAction({
  name: 'trackDurableBoundaries',
  report: false,
  act: (s: SyncHarness, clientId: string) => {
    s.runtime.kernel.durableCrashPoints.track(clientId);
  },
});

/** Kill the client at boundary `at`, just before or just after its commit. */
export const armDurableCrash = defineAction({
  name: 'armDurableCrash',
  act: (s: SyncHarness, clientId: string, at: number, when: CrashMoment) => {
    s.runtime.kernel.durableCrashPoints.arm(clientId, { at, when });
  },
});

/**
 * Append `token` to note `noteId` through `clientId`, recording what the
 * person was told. Never throws for a dead process: dying is an outcome.
 */
export const durableAppend = defineAction({
  name: 'durableAppend',
  act: async (
    s: SyncHarness,
    clientId: string,
    noteId: string,
    token: string
  ) => {
    const client = s.clients.get(clientId);
    if (client === undefined) {
      outcomes(s).set(token, 'notMade');
      return;
    }
    try {
      const result = await client.mutate(appendNoteToken, {
        id: noteId,
        token,
      });
      outcomes(s).set(token, result.ok ? 'acknowledged' : 'refused');
    } catch (error) {
      if (!(error instanceof HarnessProcessDied)) throw error;
      outcomes(s).set(token, 'died');
    }
  },
});

/** Token → what the person was told, for every {@link durableAppend}. */
export function durableWriteOutcomes(
  s: SyncHarness
): Record<string, DurableWriteOutcome> {
  return Object.fromEntries(outcomes(s));
}

export function durableBoundaries(
  s: SyncHarness,
  clientId: string
): DurableBoundary[] {
  return [...s.runtime.kernel.durableCrashPoints.boundaries(clientId)];
}

export function durableCrashes(s: SyncHarness): DurableCrash[] {
  return [...s.runtime.kernel.durableCrashPoints.crashes()];
}

/** True once the client's process was killed at a durable boundary. */
export function diedAtBoundary(s: SyncHarness, clientId: string): boolean {
  return s.runtime.kernel.durableCrashPoints
    .crashes()
    .some((crash) => crash.clientId === clientId);
}

/** True while the client's process is running. */
export function clientAlive(s: SyncHarness, clientId: string): boolean {
  return s.clients.has(clientId);
}

export type StoredWork = {
  /** The note exists (live) on the device. */
  readonly present: boolean;
  /** Tokens on the note as the device showed it. */
  readonly shown: readonly string[];
  /** Tokens in writes still waiting to upload. */
  readonly queued: readonly string[];
};

/**
 * What a client's storage holds right now — live or as a dead process left
 * it — without opening an engine on it.
 */
export async function storedWork(
  s: SyncHarness,
  clientId: string,
  noteId: string
): Promise<StoredWork & Record<string, JsonValue>> {
  const db =
    s.clients.get(clientId)?.dbBundle.serial ??
    s.runtime.kernel.metas.get(clientId)?.lastDbBundle?.serial;
  if (db === undefined) return { present: false, shown: [], queued: [] };
  // A process killed mid-reconcile or mid cache-wipe leaves tables missing.
  const tables = new Set(
    (
      await db.query(sql<{ name: string }>`
        SELECT name FROM sqlite_master WHERE type = 'table'
      `)
    ).map((row) => row.name)
  );
  const notes = tables.has('notes')
    ? await db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = ${noteId} AND deleted_at IS NULL
      `)
    : [];
  const pending = tables.has('sync_engine_mutations')
    ? await db.query(sql<{ name: string; args: string }>`
        SELECT name, args FROM sync_engine_mutations
        WHERE deleted_at IS NULL
        ORDER BY seq ASC
      `)
    : [];
  const queued = pending
    .filter((row) => row.name === appendNoteToken.name)
    .map((row) => (JSON.parse(row.args) as { token: string }).token);
  return {
    present: notes[0] !== undefined,
    shown: appendedTokens(notes[0]?.body ?? ''),
    queued,
  };
}
