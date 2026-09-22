import type { OauthProviderId } from '../shared/auth-constants';
import type { AuthIdentity } from '../shared/auth-identity';
import type { SignInOptions, SignInStrategy } from '../shared/sign-in-strategy';
import type { AuthSessionStore } from './auth-session-state';

export type GetFreshTokenOptions = {
  /** Force a network mint (adapter `skipCache`) after an auth 401. */
  readonly skipCache?: boolean;
};

/**
 * Client-side auth port. Framework-free: adapters expose the reactive
 * session through {@link AuthSessionStore}; UI bindings subscribe to it.
 */
export interface AuthClientPort {
  /** Slug stored in `auth_external_accounts.provider` for this adapter. */
  readonly providerLabel: string;
  /** Reactive session snapshot (hydrated lazily on first `refresh()`). */
  readonly session: AuthSessionStore;
  /**
   * Sign in with a provider. Throws `AuthFlowError` (cancelled, provider
   * failure, …) or `AuthLinkRequiredError` (the address matched an existing
   * account that must be proven or declined).
   */
  signIn(strategy: SignInStrategy, options?: SignInOptions): Promise<void>;
  /** Clears every auth-provider session on this client. */
  signOut(): Promise<void>;
  /** Revoke every session the account holds, on every device, then sign out. */
  signOutEverywhere(): Promise<void>;
  /** The signed-in account's sign-in methods. */
  listIdentities(): Promise<readonly AuthIdentity[]>;
  /**
   * Mint the link ticket ahead of time so {@link linkProvider} can open the
   * provider from the user's tap without awaiting the network first.
   */
  prepareLink(): Promise<void>;
  /** Add a sign-in method to the signed-in account. */
  linkProvider(provider: OauthProviderId): Promise<void>;
  /** Remove a sign-in method; refused (`last_identity`) for the last one. */
  unlinkProvider(provider: OauthProviderId): Promise<readonly AuthIdentity[]>;
  /** Decline a pending link: the parked identity becomes its own account. */
  createSeparateAccount(pendingLinkToken: string): Promise<void>;
  getFreshToken(options?: GetFreshTokenOptions): Promise<string | null>;
  /** Activates a provider session after OAuth redirect (no-op when unsupported). */
  ensureSessionReady?(): Promise<void>;
  /**
   * Completes same-tab OAuth return on `/sso-callback` via `rotating_token_nonce`
   * (web). No-op when unsupported or when no nonce is present.
   */
  completeHostedAuthRedirect?(): Promise<void>;
}
