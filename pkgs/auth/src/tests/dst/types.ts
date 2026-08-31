import type { SqlClient } from '@pkgs/sql-client/interface';
import type { createAuthServerAdapter } from '../../server/create-auth-server-adapter';

export type AuthFabric = 'sqlite-mem' | 'postgres-mem';

export const AUTH_FABRICS: readonly AuthFabric[] = [
  'sqlite-mem',
  'postgres-mem',
];

export const AUTH_DST_BASE_URL = 'http://auth.test';
export const AUTH_DST_SECRET = 'auth-dst-secret-0123456789abcdef';
export const AUTH_DST_TRUSTED_ORIGINS: readonly string[] = [
  AUTH_DST_BASE_URL,
  'gamezilla://',
  'http://localhost:5173',
  'http://callback.test',
];

/** Per-actor client session bag (zero-endpoint node). */
export type ActorState = {
  bearer: string | null;
  pendingAuthUrl: string | null;
  pendingCode: string | null;
};

export type AuthStore = {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly server: ReturnType<typeof createAuthServerAdapter>;
  readonly fetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export type AuthSystem = {
  store: AuthStore | null;
  readonly actors: Map<string, ActorState>;
  readonly googleSubjects: Map<string, string>;
  googleFault: boolean;
  /** Recorded by `settle` so dual-open runs can compare determinism. */
  fingerprint: string | null;
};

export function createAuthSystem(): AuthSystem {
  return {
    store: null,
    actors: new Map(),
    googleSubjects: new Map(),
    googleFault: false,
    fingerprint: null,
  };
}

export function requireStore(system: AuthSystem): AuthStore {
  if (system.store === null) {
    throw new Error('auth DST: auth.store node is not booted');
  }
  return system.store;
}

export function requireActor(system: AuthSystem, id: string): ActorState {
  const actor = system.actors.get(id);
  if (actor === undefined) {
    throw new Error(`auth DST: no auth.actor node ${id}`);
  }
  return actor;
}
