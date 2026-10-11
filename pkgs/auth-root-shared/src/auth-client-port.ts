import type { AuthIdentity } from './auth-identity';
import type { AuthSessionStore } from './auth-session-state';
import type { OauthProviderId, SignInMethodId } from './sign-in-method';

export type GetFreshTokenOptions = {
  /** Force a network mint (bypass any cached token) after an auth 401. */
  readonly skipCache?: boolean;
};

export type SignInOptions = {
  /**
   * Finish a pending link: this sign-in proves the account an earlier
   * sign-in's address matched, and the parked identity joins it.
   */
  readonly pendingLink?: string;
};

/**
 * Client-side auth port: everything the app asks of an auth service from the
 * device. Framework-free — adapters expose the reactive session through
 * {@link AuthSessionStore} and UI bindings subscribe to it.
 *
 * An adapter wraps one service (the in-house IdP, Clerk, Firebase Auth,
 * WorkOS, Cognito, Better Auth, …) and owns everything about how that
 * service is reached: its SDK, its token storage, its redirect handling.
 * Failures the UI can explain are thrown as `AuthFlowError`; an address that
 * matched another account is thrown as `AuthLinkRequiredError`.
 */
export interface AuthClientPort {
  /** Same id as the server adapter's `AuthServerPort.provider`. */
  readonly provider: string;
  /** Reactive session snapshot (hydrated lazily on first `refresh()`). */
  readonly session: AuthSessionStore;
  /** Sign in with a social provider. */
  signIn(provider: OauthProviderId, options?: SignInOptions): Promise<void>;
  /**
   * Ask the service to email a sign-in link. Resolves the same whether or not
   * a link was sent: it never reveals whether an account exists or whether
   * the address is one the service mails. Throws for a malformed address,
   * for too many requests, or when the service has no email sign-in.
   */
  requestEmailLink(email: string, options?: SignInOptions): Promise<void>;
  /**
   * Finish signing in from an emailed link: the whole link, or its bare
   * token. A link works once and only for a short while (`expired` after).
   */
  signInWithEmailLink(link: string): Promise<void>;
  /** Ends this device's session with the service. */
  signOut(): Promise<void>;
  /** Revoke every session the user holds, on every device, then sign out. */
  signOutEverywhere(): Promise<void>;
  /** The signed-in user's sign-in methods. */
  listIdentities(): Promise<readonly AuthIdentity[]>;
  /**
   * Do any network work {@link linkProvider} needs ahead of time, so it can
   * open the provider from the user's tap without awaiting first (popup
   * blockers). A no-op for services that need none.
   */
  prepareLink(): Promise<void>;
  /** Add a sign-in method to the signed-in user. */
  linkProvider(provider: OauthProviderId): Promise<void>;
  /** Remove a sign-in method; refused (`last_identity`) for the last one. */
  unlinkProvider(provider: SignInMethodId): Promise<readonly AuthIdentity[]>;
  /** Decline a pending link: the parked identity becomes its own user. */
  createSeparateAccount(pendingLinkToken: string): Promise<void>;
  /**
   * A bearer token the product API accepts (`AuthServerPort.verifySessionToken`),
   * or `null` when signed out.
   */
  getFreshToken(options?: GetFreshTokenOptions): Promise<string | null>;
  /**
   * Finishes a same-tab redirect sign-in when the app loads on its callback
   * route. Absent when the service never redirects the whole tab.
   */
  completeHostedAuthRedirect?(): Promise<void>;
}
