/**
 * Kit methods built in system `create` over a shared store + replicas.
 */

import type { JsonValue } from '@pkgs/harness-root-shared-ts/json';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { MatchmakingDevice } from '@pkgs/matchmaking-root-shared-ts/device';
import type { SearchRequest } from '@pkgs/matchmaking-root-shared-ts/identity';
import type { TickResult } from '@pkgs/matchmaking-root-shared-ts/matchmaking';
import type {
  DistanceFormula,
  JoinInput,
  JoinResult,
  LeaveResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking-root-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import type { Hono } from 'hono';
import type { HarnessReplica, MatchmakingHarnessRuntime } from './api';
import type { ReplicaBootConfig } from './boot-replica';
import { bootReplicaOnStore } from './boot-replica';
import { refreshDevices } from './devices';
import type { ReplicaOps } from './handles';
import { buildHarnessReplica, joinOnReplica, resolveReplica } from './handles';
import type { MmReplicaBoot } from './node-kinds';

/** Last result of each write action — read back through observations. */
export type MatchmakingLastResults = {
  tick: TickResult | null;
  tickAll: readonly TickResult[] | null;
  leave: LeaveResult | null;
  update: UpdateFormulasResult | null;
  http: { readonly status: number; readonly body: JsonValue } | null;
  /** How the example app answered the last person asking to wait. */
  wait: 'waiting' | 'alreadyWaiting' | 'unavailable' | null;
  begin: JoinResult | null;
  offline: boolean;
};

export type MatchmakingHarness = MatchmakingHarnessRuntime & {
  readonly session: Session;
  readonly db: SqlClient;
  readonly ports: {
    readonly rng: SeededRng;
    readonly clock: Session['ports']['clock'];
  };
  /** Test-chosen alias → participantId, filled in by the `join` action. */
  readonly refs: Map<string, string>;
  readonly owners: Map<string, string>;
  deviceReplicaId: string | undefined;
  readonly devices: Map<string, MatchmakingDevice>;
  readonly begins: Map<string, JoinInput[]>;
  readonly changes: Map<
    string,
    { request: SearchRequest; formulas: readonly DistanceFormula[] }[]
  >;
  readonly last: MatchmakingLastResults;
  /** Lazily built Hono app per replica, for the `httpRequest` action. */
  readonly apps: Map<string, Hono>;
};

export function buildMatchmakingHarness(args: {
  readonly session: Session;
  readonly store: import('./store').HarnessStore;
  readonly boots: readonly MmReplicaBoot[];
  readonly config: ReplicaBootConfig;
  readonly rng: SeededRng;
}): MatchmakingHarness {
  const { session, store, boots, config, rng } = args;
  if (boots.length === 0) {
    throw new Error('buildMatchmakingHarness: no replicas booted');
  }
  const firstId = boots[0]!.id;
  const replicas = new Map<string, HarnessReplica>();
  const owners = new Map<string, string>();
  const ops: ReplicaOps = {
    owners,
    createId: session.ports.createId,
    getMm: (replicaId) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };
  for (const boot of boots) {
    replicas.set(boot.id, buildHarnessReplica(ops, boot.id, boot.mm));
  }

  const surface: MatchmakingHarness = {
    session,
    db: store.openClient(),
    replicas,
    refs: new Map<string, string>(),
    owners,
    deviceReplicaId: undefined,
    devices: new Map(),
    begins: new Map(),
    changes: new Map(),
    apps: new Map<string, Hono>(),
    last: {
      tick: null,
      tickAll: null,
      leave: null,
      update: null,
      http: null,
      wait: null,
      begin: null,
      offline: false,
    },
    ports: {
      rng,
      clock: session.ports.clock,
    },
    replica: (id) => resolveReplica(replicas, id),
    addReplica: async (id) => {
      if (replicas.has(id)) {
        throw new Error(`matchmaking surface: replica ${id} already exists`);
      }
      const mm = await bootReplicaOnStore({
        store,
        clock: session.ports.clock,
        rng,
        replicaId: id,
        config,
      });
      const handle = buildHarnessReplica(ops, id, mm);
      replicas.set(id, handle);
      return handle;
    },
    get mm() {
      return resolveReplica(replicas, firstId).mm;
    },
    join: (input, replicaId) =>
      joinOnReplica({ replicas, ops, firstId }, input, replicaId),
    tick: async (opts, replicaId) => {
      const result = await resolveReplica(replicas, replicaId ?? firstId).tick(
        opts
      );
      await refreshDevices(surface);
      return result;
    },
    tickAll: async (opts) => {
      const result = await Promise.all(
        [...replicas.values()].map((r) => r.tick(opts))
      );
      await refreshDevices(surface);
      return result;
    },
  };
  return surface;
}

export async function assertReplicaAgreement(
  surface: MatchmakingHarness
): Promise<void> {
  const replicaIds = [...surface.replicas.keys()];
  if (replicaIds.length === 0) {
    throw new Error('matchmaking.no-replicas: kit has no replicas');
  }
  const searches = [...surface.owners.entries()];
  for (const [participantId, ownerId] of searches) {
    let first: unknown;
    for (const [index, id] of replicaIds.entries()) {
      const st = await surface.replica(id).mm.status(ownerId, participantId);
      if (index === 0) first = st;
      else if (JSON.stringify(st) !== JSON.stringify(first))
        throw new Error(
          `matchmaking.replica-diverge: ${id} disagrees about ${participantId}`
        );
    }
  }
  for (const ownerId of new Set(surface.owners.values())) {
    let first: unknown;
    for (const [index, id] of replicaIds.entries()) {
      const current = await surface.replica(id).mm.current(ownerId);
      if (index === 0) first = current;
      else if (JSON.stringify(current) !== JSON.stringify(first))
        throw new Error(
          `matchmaking.replica-diverge: ${id} disagrees about ${ownerId}'s current wait`
        );
    }
  }
}
