import {
  defineLibrary,
  defineSystem,
  defineSystemKnob,
} from '@pkgs/determinism';
import fc from 'fast-check';

import {
  type AdvanceClockAction,
  arbAdvanceClock,
  arbAuthDomainOps,
  arbGoogleFault,
  type GoogleFaultAction,
} from './actions';
import { dispatchAuthDomainOp } from './dispatch';
import {
  assertAuthInvariants,
  checkAuthInvariants,
  worldFingerprint,
} from './invariants';
import { AUTH_ACTOR_KIND, AUTH_STORE_KIND } from './nodes';
import { type AuthFabric, type AuthSystem, createAuthSystem } from './types';

const AUTH_SYSTEM_START_MS = 1_700_000_000_000;

const advanceClockLibrary = defineLibrary<AuthSystem>({
  kind: 'advanceClock',
  arb: () => arbAdvanceClock(),
  dispatch: async (world, action) => {
    await world.runFor((action as AdvanceClockAction).ms);
  },
});

const googleFaultLibrary = defineLibrary<AuthSystem>({
  kind: 'setGoogleFault',
  arb: () => arbGoogleFault(),
  dispatch: async (world, action) => {
    world.system.googleFault = (action as GoogleFaultAction).fault;
  },
});

/**
 * `auth.store` (SQL + Hono IdP + fake Google) plus N zero-endpoint
 * `auth.actor` session bags. Framework owns the world via openWorld.
 */
export const AUTH_SYSTEM = defineSystem<AuthSystem>({
  id: 'auth.idp',
  system: createAuthSystem,
  startMs: AUTH_SYSTEM_START_MS,
  knobs: [
    defineSystemKnob<AuthFabric>({
      id: 'fabric',
      default: 'sqlite-mem',
      arb: fc.constantFrom<AuthFabric[]>('sqlite-mem', 'postgres-mem'),
    }),
    defineSystemKnob<number>({
      id: 'clientCount',
      default: 2,
      arb: fc.integer({ min: 1, max: 3 }),
    }),
    defineSystemKnob<boolean>({
      id: 'devProvider',
      default: true,
      arb: fc.constant(true),
    }),
    defineSystemKnob<boolean>({
      id: 'googleProvider',
      default: true,
      arb: fc.constant(true),
    }),
  ],
  nodes: [
    { kind: AUTH_STORE_KIND, role: 'store', count: 1 },
    {
      kind: AUTH_ACTOR_KIND,
      role: 'client',
      countFromKnob: 'clientCount',
      idFor: (i) => `c${i}`,
    },
  ],
  library: [advanceClockLibrary, googleFaultLibrary],
  domain: {
    arbs: (ctx) => arbAuthDomainOps(ctx.roleIds('client')),
    dispatch: dispatchAuthDomainOp,
  },
  checkInvariants: checkAuthInvariants,
  settle: async (world) => {
    await world.runUntilIdle();
    await assertAuthInvariants(world);
    world.system.fingerprint = await worldFingerprint(world);
  },
});
