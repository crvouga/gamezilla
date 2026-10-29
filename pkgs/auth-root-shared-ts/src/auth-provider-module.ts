/**
 * An auth service, as a composition root sees it. Every auth adapter package
 * (the in-house IdP today; Clerk, Firebase Auth, WorkOS, Cognito or Better
 * Auth tomorrow) exports exactly one of these. The composition root builds it
 * and hands the product the result; the product never learns which service
 * it holds. Swapping services is a change to which module the root builds and
 * to configuration — never to product code.
 */
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { AuthServerPort } from './auth-server-port';
import type { SignInMethodId } from './sign-in-method';

/** What a service is built from. */
export type AuthProviderEnv = {
  /** A secret or binding by name: trimmed, `null` when unset or blank. */
  readonly readSecret: (name: string) => Promise<string | null>;
  /** Production deployment: mock-only configuration must be refused. */
  readonly isProduction: boolean;
  /** Public origin of the product API (no path). */
  readonly apiOrigin: string;
  /** Path the API serves under (`/api`); `''` when rooted at `/`. */
  readonly apiPathPrefix: string;
  /** Web origins allowed to receive sign-in redirects. */
  readonly clientOrigins: readonly string[];
  /**
   * Deep-link schemes of the native clients allowed to receive sign-in
   * redirects (`myapp` for `myapp://sso-callback`).
   */
  readonly clientSchemes: readonly string[];
  readonly clock: Clock;
  readonly createId: CreateId;
  /** Outbound HTTP to the service (or the providers it federates). */
  readonly http: HttpClient;
  /**
   * The API's request-scoped database. Only a service that keeps its own
   * tables beside the product's reads it; a hosted service ignores it.
   */
  readonly getSql: () => SqlClient;
  /**
   * The service changed a user's sign-in methods on its own, with no request
   * from the product: a provider deleted a linked account, or switched its
   * email forwarding. The product re-reads the user
   * ({@link AuthServerPort.getUser}) and pushes the change to their devices,
   * which would otherwise keep showing the old methods.
   */
  readonly onUserChanged: (externalUserId: string) => Promise<void>;
};

/**
 * Requests the service answers on the product API's own origin (a
 * self-hosted IdP's endpoints, a vendor's webhook receiver).
 */
export type AuthProviderHandler = {
  /** Path under `apiPathPrefix` whose requests all go to {@link fetch}. */
  readonly pathPrefix: string;
  /** Receives the original request, full URL included. */
  fetch(request: Request): Promise<Response>;
};

/** A built service. */
export type AuthProvider = {
  readonly server: AuthServerPort;
  /**
   * The sign-in methods configured on the service — what the UI offers:
   * each social provider, and `email` when it can mail sign-in links.
   */
  readonly signInMethods: readonly SignInMethodId[];
  /** Absent when every endpoint lives on the service's own domain. */
  readonly handler?: AuthProviderHandler;
};

export type AuthProviderModule = {
  /** The id its adapters report (`AuthServerPort.provider`). */
  readonly provider: string;
  /**
   * Builds the service. Throws {@link AuthProviderConfigError} when its
   * configuration is missing or partial — a misconfiguration, never a
   * degraded mode.
   */
  create(env: AuthProviderEnv): Promise<AuthProvider>;
  /**
   * Schema the service keeps in the product's Postgres, run by reconcile.
   * Absent for a hosted service.
   */
  reconcilePostgres?(args: {
    readonly sqlClient: SqlClient;
    readonly dbScope: PostgresDbScope;
  }): Promise<void>;
};

/** A module could not be built from its configuration. */
export class AuthProviderConfigError extends Error {
  constructor(provider: string, message: string) {
    super(`auth provider ${provider}: ${message}`);
    this.name = 'AuthProviderConfigError';
  }
}
