import { defineScenario } from '@pkgs/dst';
import type { AuthModel } from './actions';
import { AUTH_ACTIONS } from './actions';
import { assertAuthInvariants, worldFingerprint } from './invariants';
import {
  AUTH_CLIENT_COUNT,
  AUTH_DEV_PROVIDER,
  AUTH_FABRIC,
  AUTH_GOOGLE_PROVIDER,
  authActorNode,
  authStoreNode,
} from './nodes';
import type { AuthKit } from './types';

const AUTH_SYSTEM_START_MS = 1_700_000_000_000;

/**
 * `auth.store` (SQL + Hono IdP + fake Google) plus N zero-endpoint
 * `auth.actor` session bags. Framework owns the world via openWorld.
 */
export const AUTH_SYSTEM = defineScenario({
  id: 'auth.idp',
  startTime: AUTH_SYSTEM_START_MS,
  knobs: {
    fabric: AUTH_FABRIC,
    clientCount: AUTH_CLIENT_COUNT,
    devProvider: AUTH_DEV_PROVIDER,
    googleProvider: AUTH_GOOGLE_PROVIDER,
  },
  nodes: {
    store: authStoreNode,
    client: {
      ...authActorNode,
      count: (k) => k['clientCount'] as number,
      id: (i) => `c${i}`,
    },
  },
  commands: AUTH_ACTIONS,
  referenceModel: {
    initial: (): AuthModel => ({}),
  },
  extend: (): AuthKit => ({ fingerprint: null }),
  always: async () => {
    /* safety checks run in settle */
  },
  converge: async (world) => {
    await world.quiesce();
    await assertAuthInvariants(world);
    world.fingerprint = await worldFingerprint(world);
  },
});

export type AuthSystemDef = typeof AUTH_SYSTEM;
export type AuthWorld = import('@pkgs/dst').World<
  AuthSystemDef['knobs'],
  AuthSystemDef['nodes'],
  AuthKit
>;
