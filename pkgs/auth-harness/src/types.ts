import type { createAuthServerAdapter } from '@pkgs/auth-inhouse-server/create-auth-server-adapter';
import type { BearerTokenStore } from '@pkgs/auth-inhouse-shared/bearer-token-store';
import type { AuthClientPort } from '@pkgs/auth-shared/auth-client-port';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { AuthModel } from './model';
import type { AuthIdps } from './providers';

export type AuthFabric = 'mockingbird-sqlite' | 'mockingbird-postgres';

export const AUTH_FABRICS: readonly AuthFabric[] = [
  'mockingbird-sqlite',
  'mockingbird-postgres',
];

/** What a person does on the provider's screens during one round trip. */
export type ProviderAnswers = {
  /** A directory address on that provider. */
  readonly email: string;
  readonly consent: 'allow' | 'deny';
  /** Apple's first authorization only. */
  readonly emailChoice: 'share' | 'hide';
};

/** How the last auth action this actor took ended, as the client saw it. */
export type ActorOutcome =
  | { readonly kind: 'ok' }
  | { readonly kind: 'error'; readonly code: string }
  | { readonly kind: 'link_required'; readonly token: string }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * One device: a real client port over a browser that keeps its cookies,
 * plus the network switch that takes it offline.
 */
export type ActorState = {
  readonly id: string;
  readonly port: AuthClientPort;
  /** The port's bearer storage, read directly by checks (and thieves). */
  readonly bearerStore: BearerTokenStore;
  online: boolean;
  /** What the person will answer on the next provider screens. */
  answers: ProviderAnswers;
  /**
   * A parked identity waiting to be proven or declined, with the sign-in
   * methods (and their addresses) that can prove the account it matched.
   */
  pendingLink: {
    readonly token: string;
    readonly providers: readonly OauthProviderId[];
    readonly emails: readonly string[];
  } | null;
  last: ActorOutcome | null;
  /**
   * The model's copy of the port's cached link ticket: minted under
   * `bearer`, reusable until a minute before `expiresAtMs`.
   */
  ticket: { readonly bearer: string; readonly expiresAtMs: number } | null;
  /** The bearer as last read back from the port (for stealing / checks). */
  bearer: string | null;
};

export type AuthStore = {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly server: ReturnType<typeof createAuthServerAdapter>;
  /** One provider node per flavor, each with its own accounts and faults. */
  readonly idps: AuthIdps;
  readonly appleClientId: string;
  readonly fetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Absolute-URL fetch across every node, for the actors' browsers. */
  readonly wire: (url: string, init?: RequestInit) => Promise<Response>;
};

export type AuthSurface = {
  readonly session: Session;
  readonly store: AuthStore;
  readonly clients: ReadonlyMap<string, ActorState>;
  /** The reference model every step is checked against. */
  readonly model: AuthModel;
  /** Divergences between the system and the model, newest last. */
  readonly violations: string[];
  /** How often each predicted outcome occurred — the walk's flow coverage. */
  readonly outcomes: Record<string, number>;
  /** The addresses each provider's directory holds right now (for sampling). */
  readonly directory: Record<OauthProviderId, readonly string[]>;
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
