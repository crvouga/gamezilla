import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import type {
  OauthProviders,
  OauthProvidersConfig,
} from './providers/registry';

export type CreateAuthAppProviders = OauthProvidersConfig;

export type CreateAuthAppDeps = {
  readonly getSql: () => SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly http: HttpClient;
  readonly secret: string;
  /** Origin only (no path), e.g. https://api.example.com */
  readonly baseURL: string;
  /**
   * Public path prefix before `/auth/*` (product mounts under `/api`).
   * Empty string for in-package DST where the app is rooted at `/`.
   */
  readonly publicPathPrefix?: string;
  readonly trustedOrigins: readonly string[];
  readonly providers: CreateAuthAppProviders;
};

/** What every handler gets: the deps plus the providers built from them once. */
export type AuthAppCtx = {
  readonly deps: CreateAuthAppDeps;
  readonly oauth: OauthProviders;
};
