/**
 * Kit methods built in system `generate` over a shared store + replicas.
 */

import type { JsonValue, Session } from '@pkgs/dst';
import { asSeededRng } from '@pkgs/dst/kernel';
import type { SeededRng } from '@pkgs/uuid';
import type { Hono } from 'hono';

import type { TickResult } from '../../interface/matchmaking';
import type { LeaveResult, UpdateFormulasResult } from '../../interface/types';
import { bootReplicaOnStore } from '../boot-replica';
import {
  buildReplicaHandle,
  joinOnReplica,
  type ReplicaOps,
  resolveReplica,
} from '../handles';
import type { MatchmakingSimKit, ReplicaHandle } from '../sim-api';
import {
  type EventuallyOptions,
  type NeverOptions,
  runNever,
  runUntil,
  type UntilTarget,
} from '../until';
import type { MmReplicaBootHandle } from './node-kinds';
import type { MatchmakingSystemConfig } from './system';

/** Last result of each write action — read back through observations. */
export type MatchmakingLastResults = {
  tick: TickResult | null;
  tickAll: readonly TickResult[] | null;
  leave: LeaveResult | null;
  update: UpdateFormulasResult | null;
  http: { readonly status: number; readonly body: JsonValue } | null;
};

export type MatchmakingSurface = MatchmakingSimKit & {
  readonly session: Session;
  readonly advance: (ms: number) => Promise<void>;
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

export function buildMatchmakingKit(args: {
  readonly session: Session;
  readonly store: import('../store').SimStore;
  readonly boots: readonly MmReplicaBootHandle[];
  readonly config: MatchmakingSystemConfig;
  readonly rng: SeededRng;
}): MatchmakingSurface {
  const { session, store, boots, config, rng } = args;
  if (boots.length === 0) {
    throw new Error('buildMatchmakingKit: no replicas booted');
  }
  const firstId = boots[0]!.id;
  const replicas = new Map<string, ReplicaHandle>();
  const ops: ReplicaOps = {
    getMm: (replicaId) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };
  for (const boot of boots) {
    replicas.set(boot.id, buildReplicaHandle(ops, boot.id, boot.mm));
  }

  async function advance(ms: number): Promise<void> {
    await session.scheduler.advance(ms);
  }

  async function step(ms: number): Promise<void> {
    await advance(ms);
    await Promise.all(
      [...replicas.values()].map((r) => r.tick({ maxPassesPerPartition: 4 }))
    );
  }

  const untilCtx = {
    clock: { now: () => session.ports.clock.now() },
    seed: BigInt(0),
    step,
  };

  return {
    session,
    advance,
    replicas,
    refs: new Map<string, string>(),
    apps: new Map<string, Hono>(),
    last: {
      tick: null,
      tickAll: null,
      leave: null,
      update: null,
      http: null,
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
      const handle = buildReplicaHandle(ops, id, mm);
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
    waitUntil: (target: UntilTarget, opts?: EventuallyOptions) =>
      runUntil(untilCtx, target, opts),
    waitNever: (target: UntilTarget, opts: NeverOptions) =>
      runNever(untilCtx, target, opts),
  };
}

export async function assertReplicaAgreement(
  surface: MatchmakingSurface
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

export type { ReplicaHandle };
export { asSeededRng };
