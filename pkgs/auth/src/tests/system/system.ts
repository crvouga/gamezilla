import { defineKnob, defineSystem } from '@pkgs/determinism';
import fc from 'fast-check';

import { AUTH_ACTIONS, type AuthModel } from './actions';
import {
  assertAuthInvariants,
  checkAuthInvariants,
  worldFingerprint,
} from './invariants';
import { authActorNode, authStoreNode } from './nodes';
import { type AuthFabric, type AuthSystem, createAuthSystem } from './types';

const AUTH_SYSTEM_START_MS = 1_700_000_000_000;

/**
 * `auth.store` (SQL + Hono IdP + fake Google) plus N zero-endpoint
 * `auth.actor` session bags. Framework owns the world via openWorld.
 */
export const AUTH_SYSTEM = defineSystem<AuthSystem, AuthModel>({
  id: 'auth.idp',
  state: createAuthSystem,
  startMs: AUTH_SYSTEM_START_MS,
  knobs: [
    defineKnob({
      id: 'fabric',
      default: 'sqlite-mem' satisfies AuthFabric,
      arb: fc.constantFrom<AuthFabric>('sqlite-mem', 'postgres-mem'),
    }),
    defineKnob({
      id: 'clientCount',
      default: 2,
      arb: fc.integer({ min: 1, max: 3 }),
    }),
    defineKnob({
      id: 'devProvider',
      default: true,
      arb: fc.constant(true),
    }),
    defineKnob({
      id: 'googleProvider',
      default: true,
      arb: fc.constant(true),
    }),
  ],
  nodes: [
    { kind: authStoreNode, role: 'store', count: 1 },
    {
      kind: authActorNode,
      role: 'client',
      countFromKnob: 'clientCount',
      idFor: (i) => `c${i}`,
    },
  ],
  actions: [...AUTH_ACTIONS],
  model: {
    initial: (): AuthModel => ({}),
  },
  invariants: checkAuthInvariants,
  settle: async (world) => {
    await world.idle();
    await assertAuthInvariants(world);
    world.state.fingerprint = await worldFingerprint(world);
  },
});
