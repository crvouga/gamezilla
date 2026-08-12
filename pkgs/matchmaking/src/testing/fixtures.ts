/**
 * Shared fixtures for matchmaking contract tests.
 * No Postgres / SqlClient / adapter imports.
 */

import { expect } from 'bun:test';
import { Assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { createSimIo, wallIo } from '@pkgs/io';
import type { MiddlewareHandler } from 'hono';
import type {
  Matchmaking,
  MatchmakingConfig,
  MatchmakingTuning,
} from '../interface/matchmaking';
import type { MatchedStatus, StatusResult } from '../interface/types';

export const testNs = createAttrNamespace('mmtest');

export const RatingAttr = testNs.number('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/rating must be a finite number');
  }
  return v;
});

export const SkillAttr = testNs.number('skill', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/skill must be a finite number');
  }
  return v;
});

export const NameAttr = testNs.text('name', (v): string =>
  typeof v === 'string' ? v : ''
);

export const RegionAttr = testNs.textOrNull('region', (v): string | null =>
  typeof v === 'string' ? v : null
);

export const KindAttr = testNs.text('kind', (v): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('mmtest/kind must be a non-empty string');
  }
  return v;
});

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const testWallIo = wallIo();

export function defaultTestTuning(
  overrides?: Partial<MatchmakingTuning>
): MatchmakingTuning {
  return {
    now: () => testWallIo.clock.now(),
    createId: testWallIo.createId,
    ...overrides,
  };
}

export async function pauseForJoinedAtOrdering(): Promise<void> {
  const timers = testWallIo.timers;
  await new Promise<void>((resolve) => {
    timers.setTimeout(resolve, 50);
  });
}

export function registerTestCrashHandler(): () => void {
  return Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${String(message)} ${JSON.stringify(context)}`
      );
    },
  });
}

export type MatchmakingFactory = (
  overrides?: BootOverrides
) => Promise<Matchmaking> | Matchmaking;

export type BootOverrides = {
  readonly schema?: MatchmakingConfig['schema'];
  readonly radius?: MatchmakingConfig['radius'];
  readonly tuning?: Partial<MatchmakingTuning>;
};

export function resolveConfig(overrides?: BootOverrides): MatchmakingConfig {
  return {
    schema: overrides?.schema ?? {},
    ...(overrides?.radius !== undefined ? { radius: overrides.radius } : {}),
    tuning: defaultTestTuning(overrides?.tuning),
  };
}

export function resolveConfigWithSimIo(
  overrides?: BootOverrides & {
    readonly sim?: { readonly seed?: number; readonly startMs?: number };
  }
): MatchmakingConfig & { readonly io: ReturnType<typeof createSimIo> } {
  const io = createSimIo({
    seed: overrides?.sim?.seed ?? 1,
    ...(overrides?.sim?.startMs !== undefined
      ? { startMs: overrides.sim.startMs }
      : {}),
  });
  return {
    schema: overrides?.schema ?? {},
    ...(overrides?.radius !== undefined ? { radius: overrides.radius } : {}),
    tuning: defaultTestTuning({
      now: () => io.clock.now(),
      createId: io.createId,
      ...overrides?.tuning,
    }),
    io,
  };
}

export const defaultStubAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header('x-test-user') === undefined) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return await next();
};

export const TEST_AUTH_HEADERS = { 'x-test-user': 'tester' } as const;

export function expectMatched(status: unknown): MatchedStatus {
  expect(status).not.toBeNull();
  const narrowed = status as MatchedStatus;
  expect(narrowed.status).toBe('matched');
  return narrowed;
}

export type { StatusResult };
