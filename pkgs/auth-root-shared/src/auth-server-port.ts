import type { AuthUser } from './auth-user';
import type { VerifiedSession } from './verified-session';

/**
 * Server-side auth port: what the product API asks of an auth service. The
 * product maps the service's users onto its own accounts (one
 * `auth_external_accounts` row per `(provider, externalUserId)`), so nothing
 * past this port ever sees a service's own ids, tables or SDK types.
 */
export interface AuthServerPort {
  /**
   * Stable id of the service. It keys the product's link from its account to
   * the service's user, so it must never change for a deployed service.
   */
  readonly provider: string;
  /** The session a client bearer names, or `null` when unknown / expired / revoked. */
  verifySessionToken(token: string): Promise<VerifiedSession | null>;
  /** The user with every sign-in method, or `null` when unknown. */
  getUser(externalUserId: string): Promise<AuthUser | null>;
  /** Idempotently withdraw identities, revoke sessions and erase the service's personal data. */
  deleteUser(externalUserId: string): Promise<void>;
}
