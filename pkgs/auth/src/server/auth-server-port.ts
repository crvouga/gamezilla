import type { AuthUserProfile } from '../shared/user-profile';
import type { VerifiedSession } from '../shared/verified-session';

/**
 * Server-side auth port. Adapters verify bearer tokens and resolve profiles
 * without importing a specific provider SDK at the port layer.
 */
export interface AuthServerPort {
  /** Slug stored in `auth_external_accounts.provider` for this adapter. */
  readonly providerLabel: string;
  verifySessionToken(token: string): Promise<VerifiedSession | null>;
  getUserProfile(externalUserId: string): Promise<AuthUserProfile | null>;
  /** Serialized auth-provider user payload (e.g. provider `UserJSON`). */
  getUserSnapshot(
    externalUserId: string
  ): Promise<Record<string, unknown> | null>;
}
