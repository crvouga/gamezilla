import type { SignInStrategy } from '../shared/sign-in-strategy';
import type { AuthSessionState } from './auth-session-state';

/**
 * Client-side auth port. Adapters implement this and mount it through
 * {@link AuthClientPortProviderProps}.
 */
export interface AuthClientPort {
  useAuthSession(): AuthSessionState;
  signIn(strategy: SignInStrategy): Promise<void>;
  signOut(): Promise<void>;
  getFreshToken(): Promise<string | null>;
  /** Activates a provider session after OAuth redirect (no-op when unsupported). */
  ensureSessionReady?(): Promise<void>;
}
