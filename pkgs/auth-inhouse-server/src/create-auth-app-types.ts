import type { Clock } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type { EmailLinkDelivery } from './email-link-delivery';
import type { OauthCallbackRelay } from './oauth-callback-relay';
import type { OauthProviders, OauthProvidersConfig } from './registry';
import type { SyntheticMonitorConfig } from './synthetic-monitor';

export type CreateAuthAppProviders = OauthProvidersConfig;

export type CreateAuthAppDeps = {
  readonly getSql: () => SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly http: HttpClient;
  readonly secret: string;
  readonly sessionLifetimeMs?: number;
  /** Origin only (no path), e.g. https://api.example.com */
  readonly baseURL: string;
  /**
   * Public path prefix before `/auth/*` (product mounts under `/api`).
   * Empty string for in-package DST where the app is rooted at `/`.
   */
  readonly publicPathPrefix?: string;
  readonly trustedOrigins: readonly string[];
  readonly providers: CreateAuthAppProviders;
  /** Shared provider callback; absent → providers call back `baseURL`. */
  readonly callbackRelay?: OauthCallbackRelay;
  /** Hidden synthetic-monitor sign-in; absent → its route answers 404. */
  readonly syntheticMonitor?: SyntheticMonitorConfig;
  /** Where emailed sign-in links go; absent → the email routes answer 404. */
  readonly emailLinks?: EmailLinkDelivery;
  /**
   * Called after the IdP changed a user's identities without the user asking
   * (a provider notification); absent → nobody is told.
   */
  readonly onUserChanged?: (userId: string) => Promise<void>;
};

/** What every handler gets: the deps plus the providers built from them once. */
export type AuthAppCtx = {
  readonly deps: CreateAuthAppDeps;
  readonly oauth: OauthProviders;
};
