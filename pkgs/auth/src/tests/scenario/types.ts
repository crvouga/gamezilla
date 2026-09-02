import type { SqlClient } from '@pkgs/sql-client/interface';
import type { createAuthServerAdapter } from '../../server/create-auth-server-adapter';

export type AuthFabric = 'sqlite-mem' | 'postgres-mem';

export const AUTH_FABRICS: readonly AuthFabric[] = [
  'sqlite-mem',
  'postgres-mem',
];

export const AUTH_SYSTEM_BASE_URL = 'http://auth.test';
export const AUTH_SYSTEM_SECRET = 'auth-system-secret-0123456789abcdef';
export const AUTH_SYSTEM_TRUSTED_ORIGINS: readonly string[] = [
  AUTH_SYSTEM_BASE_URL,
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
  readonly sim: {
    googleFault: boolean;
    googleSubjects: Map<string, string>;
  };
  readonly fetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export function requireStore(store: AuthStore | undefined): AuthStore {
  if (store === undefined) {
    throw new Error('auth system: auth.store node is not booted');
  }
  return store;
}

export function requireActor(
  actors: ReadonlyMap<string, ActorState>,
  id: string
): ActorState {
  const actor = actors.get(id);
  if (actor === undefined) {
    throw new Error(`auth system: no auth.actor node ${id}`);
  }
  return actor;
}

export type AuthWorldNodes = {
  readonly store: AuthStore;
  readonly client: ReadonlyMap<string, ActorState>;
};

export type AuthKit = {
  /** Recorded by `settle` so dual-open runs can compare determinism. */
  fingerprint: string | null;
};
