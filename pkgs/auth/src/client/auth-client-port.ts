import type {
  SignInCredentials,
  SignInStrategy,
} from '../shared/sign-in-strategy';
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
  signIn(
    strategy: SignInStrategy,
    credentials?: SignInCredentials
  ): Promise<void>;
  /** Clears every auth-provider session on this client. */
  signOut(): Promise<void>;
  getFreshToken(options?: GetFreshTokenOptions): Promise<string | null>;
  /** Activates a provider session after OAuth redirect (no-op when unsupported). */
  ensureSessionReady?(): Promise<void>;
  /**
   * Completes same-tab OAuth return on `/sso-callback` via `rotating_token_nonce`
   * (web). No-op when unsupported or when no nonce is present.
   */
  completeHostedAuthRedirect?(): Promise<void>;
}
