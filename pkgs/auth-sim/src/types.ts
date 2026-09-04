import type { createAuthServerAdapter } from '@pkgs/auth/server/create-auth-server-adapter';
import type { Session } from '@pkgs/sim';
import type { SqlClient } from '@pkgs/sql-client/interface';

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

/** Per-actor client session bag (zero-endpoint). */
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

export type AuthSurface = {
  readonly session: Session;
  readonly store: AuthStore;
  readonly clients: ReadonlyMap<string, ActorState>;
  fingerprint: string | null;
  /** Status of the last `fetchAuth` action, read back via `lastStatus`. */
  lastStatus: number | null;
};

export function requireStore(store: AuthStore | undefined): AuthStore {
  if (store === undefined) {
    throw new Error('auth system: store is not booted');
  }
  return store;
}

export function requireActor(
  actors: ReadonlyMap<string, ActorState>,
  id: string
): ActorState {
  const actor = actors.get(id);
  if (actor === undefined) {
    throw new Error(`auth system: no actor ${id}`);
  }
  return actor;
}
