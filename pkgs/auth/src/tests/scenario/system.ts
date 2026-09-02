import {
  type ActionCatalog,
  defineScenario,
  nodeCount,
  properties,
  property,
} from '@pkgs/dst';
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
import type { AuthKit, AuthKnobs, AuthSurface } from './types';

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
      count: nodeCount<AuthKnobs>((k) => k.clientCount),
      id: (i) => `c${i}`,
    },
  },
  actions: AUTH_ACTIONS as unknown as ActionCatalog<AuthKit>,
  properties: properties<AuthSurface>()({
    invariantsAtConverge: property.always(async () => true, { at: 'converge' }),
  }),
  extend: (): AuthKit => ({ fingerprint: null }),
  converge: async (world) => {
    const authWorld = world as AuthSurface;
    await authWorld.quiesce();
    await assertAuthInvariants(authWorld);
    authWorld.fingerprint = await worldFingerprint(authWorld);
  },
});

export type AuthSystemDef = typeof AUTH_SYSTEM;
export type AuthWorld = AuthSurface;
