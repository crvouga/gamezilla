import type { Repro } from '@pkgs/dst';
import { explore, REPRO_VERSION } from '@pkgs/dst';

import {
  createSyncActions,
  defineSyncSystem,
  SYNC_PROPERTIES,
  syncKnobs,
  syncVirtualHost,
} from '../../sim/scenario';
import type { SyncApp } from '../../sim/scenario/app';

export type SeedFailureArtifact = {
  readonly repro: Repro & {
    readonly meta: Repro['meta'] & {
      readonly error: string;
      readonly seedHex: string;
      readonly failureStep: number;
    };
  };
  readonly error: string;
};

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
      readonly artifact: SeedFailureArtifact;
    };

export type RunSeedOptions = {
  readonly app: SyncApp;
  readonly seed: number | bigint | string;
  readonly clientCount?: number;
  readonly steps?: number;
  readonly sampleFaults?: boolean;
  /** Mild fixed reorder/loss (see {@link DST_FAULTS}). */
  readonly dstFaults?: boolean;
};

function seedNumber(seed: number | bigint | string): number {
  if (typeof seed === 'number') return seed;
  if (typeof seed === 'bigint') return Number(seed);
  const n = Number.parseInt(seed, 10);
  return Number.isFinite(n) ? n : 0;
}

function seedBigInt(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') return seed;
  if (typeof seed === 'number') return BigInt(seed);
  try {
    return BigInt(seed);
  } catch {
    return BigInt(seedNumber(seed));
  }
}

/**
 * Run one seeded universe: N clients, random walk over the sync action pool.
 * On failure returns seed + scenario artifact for exact replay.
 */
export async function runSeed(opts: RunSeedOptions): Promise<RunSeedResult> {
  const system = defineSyncSystem(opts.app);
  const seed = seedNumber(opts.seed);
  const seedBi = seedBigInt(opts.seed);
  const steps = opts.steps ?? 40;
  const clientCount = opts.clientCount ?? 2;
  try {
    const report = await explore(system, {
      host: syncVirtualHost(),
      properties: [...SYNC_PROPERTIES],
      actions: [...createSyncActions(opts.app, opts.app.pack.sessionQuery)],
      knobs: syncKnobs({ clientCount }),
      episodes: 1,
      steps,
      seed,
      stopOnViolation: true,
      time: { weight: 1, minMs: 0, maxMs: 40 },
    });
    if (!report.ok) {
      const failure = report.failures[0];
      const error = failure?.error ?? 'explore failed';
      return {
        ok: false,
        seed: seedBi,
        steps: failure?.repro.choices.length ?? 0,
        error,
        artifact: {
          repro: {
            ...(failure?.repro ?? {
              version: REPRO_VERSION,
              seed,
              knobs: null,
              choices: [],
              meta: { system: 'sync.runSeed' },
            }),
            meta: {
              system: 'sync.runSeed',
              error,
              seedHex: seedBi.toString(16),
              failureStep: failure?.repro.choices.length ?? 0,
            },
          },
          error,
        },
      };
    }
    return { ok: true, seed: seedBi, steps };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      seed: seedBi,
      steps: 0,
      error: message,
      artifact: {
        repro: {
          version: REPRO_VERSION,
          seed,
          knobs: null,
          choices: [],
          meta: {
            system: 'sync.runSeed',
            error: message,
            seedHex: seedBi.toString(16),
            failureStep: 0,
          },
        },
        error: message,
      },
    };
  }
}

/** Parse SYNC_SIM_SEED / SYNC_SIM_SEEDS env for CI / local replay. */
export function seedsFromEnv(env: {
  readonly SYNC_SIM_SEED?: string | undefined;
  readonly SYNC_SIM_SEEDS?: string | undefined;
}): number[] {
  if (env.SYNC_SIM_SEED !== undefined && env.SYNC_SIM_SEED.length > 0) {
    return [Number.parseInt(env.SYNC_SIM_SEED, 10)];
  }
  if (env.SYNC_SIM_SEEDS !== undefined && env.SYNC_SIM_SEEDS.length > 0) {
    return env.SYNC_SIM_SEEDS.split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}
