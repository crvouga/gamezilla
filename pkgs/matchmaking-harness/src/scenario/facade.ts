/**
 * Kit methods built in system `create` over a shared store + replicas.
 */

import { asSeededRng, type JsonValue, type Session } from '@pkgs/harness';
import type {
  LeaveResult,
  TickResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import type { SeededRng } from '@pkgs/uuid';
import type { Hono } from 'hono';
import type { HarnessReplica, MatchmakingHarnessRuntime } from '../api';
import { bootReplicaOnStore, type ReplicaBootConfig } from '../boot-replica';
import {
  buildHarnessReplica,
  joinOnReplica,
  type ReplicaOps,
  resolveReplica,
} from '../handles';
import type { MmReplicaBoot } from './node-kinds';

/** Last result of each write action — read back through observations. */
export type MatchmakingLastResults = {
  tick: TickResult | null;
  tickAll: readonly TickResult[] | null;
  leave: LeaveResult | null;
  update: UpdateFormulasResult | null;
  http: { readonly status: number; readonly body: JsonValue } | null;
  /** How the example app answered the last person asking to wait. */
  wait: 'waiting' | 'alreadyWaiting' | null;
};

export type MatchmakingHarness = MatchmakingHarnessRuntime & {
  readonly session: Session;
  readonly ports: {
    readonly rng: SeededRng;
    readonly clock: Session['ports']['clock'];
  };
  /** Test-chosen alias → participantId, filled in by the `join` action. */
  readonly refs: Map<string, string>;
  readonly last: MatchmakingLastResults;
  /** Lazily built Hono app per replica, for the `httpRequest` action. */
  readonly apps: Map<string, Hono>;
};

export function buildMatchmakingHarness(args: {
  readonly session: Session;
  readonly store: import('../store').HarnessStore;
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
  const ops: ReplicaOps = {
    getMm: (replicaId) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };
  for (const boot of boots) {
    replicas.set(boot.id, buildHarnessReplica(ops, boot.id, boot.mm));
  }

  return {
    session,
    replicas,
    refs: new Map<string, string>(),
    apps: new Map<string, Hono>(),
    last: {
      tick: null,
      tickAll: null,
      leave: null,
      update: null,
      http: null,
      wait: null,
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
    tick: (opts, replicaId) =>
      resolveReplica(replicas, replicaId ?? firstId).tick(opts),
    tickAll: (opts) =>
      Promise.all([...replicas.values()].map((r) => r.tick(opts))),
  };
}

export async function assertReplicaAgreement(
  surface: MatchmakingHarness
): Promise<void> {
  const replicaIds = [...surface.replicas.keys()];
  if (replicaIds.length === 0) {
    throw new Error('matchmaking.no-replicas: kit has no replicas');
  }
  const probeId = '00000000-0000-0000-0000-000000000000';
  let first: unknown;
  for (let i = 0; i < replicaIds.length; i += 1) {
    const id = replicaIds[i]!;
    const r = surface.replicas.get(id);
    if (r === undefined) {
      throw new Error(`matchmaking.missing-replica: replica ${id} missing`);
    }
    const st = await r.mm.status(probeId);
    if (i === 0) first = st;
    else if (JSON.stringify(st) !== JSON.stringify(first)) {
      throw new Error(
        `matchmaking.replica-diverge: replica ${id} status disagrees with ${replicaIds[0]}`
      );
    }
  }
}

export type { HarnessReplica };
export { asSeededRng };
