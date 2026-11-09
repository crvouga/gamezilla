/**
 * Seeded network adversary. Same profile + seed + device list ⇒ the same
 * fault moves, so every failing run replays bit for bit. Moves are applied
 * through the recorded fault actions, so they show in the run report.
 */

import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import type { HarnessHttpFault } from './edge-faults';
import { toBoundaryMove } from './fault-adversary-boundary';
import type { FaultProfile } from './fault-profiles';
import { RELIABLE_FAULTS } from './faults';
import type { SyncHarness } from './scenario-system';
import { clientIds, clock } from './sync-observations';

/** One concrete fault the adversary applies. */
export type FaultMove =
  | {
      readonly kind: 'offline';
      readonly clientId: string;
      /** `signal`: the app is told it is offline; `silent`: requests vanish. */
      readonly mode: 'signal' | 'silent';
      readonly ms: number;
    }
  | {
      readonly kind: 'liveCut';
      readonly clientId: string;
      readonly ms: number;
    }
  | {
      readonly kind: 'http';
      readonly clientId: string;
      readonly fault: HarnessHttpFault;
    }
  | { readonly kind: 'pubsub'; readonly fault: HarnessPubsubFault }
  | { readonly kind: 'pushDropped' }
  | { readonly kind: 'skew'; readonly nodeId: string; readonly ms: number };

export type FaultAdversary = {
  readonly profile: FaultProfile;
  /** Draw this turn's moves (deterministic in seed, turn order and ids). */
  readonly plan: (clientIds: readonly string[]) => readonly FaultMove[];
  /** Apply this turn's moves and lift gaps that ended by `now`. */
  readonly turn: (s: Run<SyncHarness>) => Promise<readonly FaultMove[]>;
  /** Lift every gap, arm and skew: the network is good again. */
  readonly heal: (s: Run<SyncHarness>) => Promise<void>;
  /** Every move applied so far, in order. */
  readonly applied: () => readonly FaultMove[];
};

function planOffline(
  profile: FaultProfile,
  rng: SeededRng,
  clientIds: readonly string[]
): FaultMove | null {
  if (clientIds.length === 0 || !rng.bool(profile.offline.chance)) return null;
  return {
    kind: 'offline',
    clientId: rng.pick(clientIds),
    mode: rng.bool(0.5) ? 'signal' : 'silent',
    ms: 1 + rng.int(Math.max(1, profile.offline.maxMs)),
  };
}

function planSkew(
  profile: FaultProfile,
  rng: SeededRng,
  clientIds: readonly string[]
): FaultMove | null {
  if (profile.maxSkewMs <= 0 || clientIds.length === 0 || !rng.bool(0.2)) {
    return null;
  }
  const ms = rng.int(profile.maxSkewMs * 2 + 1) - profile.maxSkewMs;
  return { kind: 'skew', nodeId: rng.pick(clientIds), ms };
}

export function planFaultTurn(
  profile: FaultProfile,
  rng: SeededRng,
  clientIds: readonly string[]
): readonly FaultMove[] {
  const moves: FaultMove[] = [];
  const offline = planOffline(profile, rng, clientIds);
  if (offline !== null) moves.push(offline);
  if (
    profile.boundary.length > 0 &&
    clientIds.length > 0 &&
    rng.bool(profile.boundaryChance)
  ) {
    const kind = rng.pick(profile.boundary);
    moves.push(toBoundaryMove(kind, rng, rng.pick(clientIds)));
  }
  const skew = planSkew(profile, rng, clientIds);
  if (skew !== null) moves.push(skew);
  return moves;
}

export type FaultGap = {
  readonly clientId: string;
  readonly traffic: 'all' | 'live';
};

function liftGap(s: SyncHarness, gap: FaultGap): void {
  const client = s.clients.get(gap.clientId);
  if (client === undefined) return;
  s.net(gap.clientId, gap.traffic).set('ok');
  if (gap.traffic === 'all') client.online(true);
}

function applyMove(s: SyncHarness, move: FaultMove): void {
  switch (move.kind) {
    case 'offline':
      if (move.mode === 'signal') s.clients.get(move.clientId)?.online(false);
      else s.net(move.clientId, 'all').set('down');
      return;
    case 'liveCut':
      s.net(move.clientId, 'live').set('down');
      return;
    case 'http':
      s.node(move.clientId).httpFault(move.fault);
      return;
    case 'pubsub':
      s.node('server').pubsubFault(move.fault);
      return;
    case 'pushDropped':
      s.node('server').publishFault('next');
      return;
    case 'skew':
      s.node(move.nodeId).skewClock(move.ms);
      return;
    default: {
      const exhaustive: never = move;
      throw new Error(`unknown fault move ${String(exhaustive)}`);
    }
  }
}

/** Lift ended gaps, then apply one adversary turn (JSON args: replayable). */
export const faultTurn = defineAction({
  name: 'faultTurn',
  describe: (lifted: readonly FaultGap[], moves: readonly FaultMove[]) =>
    `faultTurn(lift ${lifted.length}, ${moves.map((m) => m.kind).join(', ') || 'none'})`,
  act: (
    s: SyncHarness,
    lifted: readonly FaultGap[],
    moves: readonly FaultMove[]
  ) => {
    for (const gap of lifted) liftGap(s, gap);
    for (const move of moves) {
      if ('clientId' in move && !s.clients.has(move.clientId)) continue;
      applyMove(s, move);
    }
  },
});

/**
 * The network is good again: every link open, every device told it is
 * online, every armed fault and clock offset cleared. Nothing is nudged —
 * recovery from here is the app's own doing.
 */
export const healNetwork = defineAction({
  name: 'healNetwork',
  act: (s: SyncHarness) => {
    s.clearEdgeFaults();
    s.kit.network.clearNodeFaults();
    s.kit.network.setDefaultFaults(RELIABLE_FAULTS);
    for (const id of [...s.clients.keys()].sort()) {
      s.net(id, 'all').set('ok');
      s.clients.get(id)?.online(true);
      s.node(id).skewClock(0);
    }
    s.node('server').skewClock(0);
  },
});

/** The link a gap move takes down, lifted once its time is up. */
function gapOf(move: FaultMove): (FaultGap & { readonly ms: number }) | null {
  if (move.kind === 'offline') {
    return { clientId: move.clientId, traffic: 'all', ms: move.ms };
  }
  if (move.kind === 'liveCut') {
    return { clientId: move.clientId, traffic: 'live', ms: move.ms };
  }
  return null;
}

/** A seeded adversary for one run. `seed` is the run's seed. */
export function createFaultAdversary(
  profile: FaultProfile,
  seed: number
): FaultAdversary {
  const rng = createSeededRng(seed).fork(`adversary:${profile.name}`);
  const gaps = new Map<string, { gap: FaultGap; until: number }>();
  const applied: FaultMove[] = [];
  const plan = (ids: readonly string[]) =>
    planFaultTurn(profile, rng, [...ids].sort());
  return {
    profile,
    plan,
    async turn(s) {
      const now = await s.read(clock);
      const lifted: FaultGap[] = [];
      for (const [key, entry] of [...gaps]) {
        if (entry.until > now) continue;
        gaps.delete(key);
        lifted.push(entry.gap);
      }
      const moves = plan(await s.read(clientIds));
      for (const move of moves) {
        const gap = gapOf(move);
        if (gap === null) continue;
        gaps.set(`${gap.clientId}:${gap.traffic}`, {
          gap: { clientId: gap.clientId, traffic: gap.traffic },
          until: now + gap.ms,
        });
      }
      await s.apply(faultTurn, lifted, moves);
      applied.push(...moves);
      return moves;
    },
    async heal(s) {
      gaps.clear();
      await s.apply(healNetwork);
    },
    applied: () => applied,
  };
}
