import type { SignInStrategy } from '../shared/sign-in-strategy';
import type { AccountSession, SignOutOptions } from './account-session';
import type { AuthSessionState } from './auth-session-state';

export type GetFreshTokenOptions = {
  /** Force a network mint (Clerk `skipCache`) after an auth 401. */
  readonly skipCache?: boolean;
};

/**
 * Client-side auth port. Adapters implement this and mount it through
 * {@link AuthClientPortProviderProps}.
 */
export interface AuthClientPort {
  /** Slug stored in `external_accounts.provider` for this adapter. */
  readonly providerLabel: string;
  useAuthSession(): AuthSessionState;
  /** Sessions registered on this client (empty until hydrated / signed out). */
  useAccountSessions(): readonly AccountSession[];
  signIn(strategy: SignInStrategy): Promise<void>;
  /**
   * Starts SSO while keeping existing sessions. Requires provider multi-session
   * mode; no-ops like {@link signIn} when already signed in are not applied.
   */
  addAccount(strategy: SignInStrategy): Promise<void>;
  /** Activates another registered session (multi-session switch). */
  switchAccount(sessionId: string): Promise<void>;
  signOut(options?: SignOutOptions): Promise<void>;
  getFreshToken(options?: GetFreshTokenOptions): Promise<string | null>;
  /** Activates a provider session after OAuth redirect (no-op when unsupported). */
  ensureSessionReady?(): Promise<void>;
  /**
   * Completes same-tab OAuth return on `/sso-callback` via `rotating_token_nonce`
   * (web). No-op when unsupported or when no nonce is present.
   */
  completeHostedAuthRedirect?(): Promise<void>;
}
