import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import type { GoogleProviderConfig } from './google-oauth';

export type AppleProviderConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type CreateAuthAppProviders = {
  readonly google?: GoogleProviderConfig;
  readonly apple?: AppleProviderConfig;
  readonly dev?: { readonly enabled: true };
};

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
