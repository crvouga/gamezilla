import type { SignInMethodId } from './sign-in-method';

/** One sign-in method on an account. */
export type AuthIdentity = {
  readonly provider: SignInMethodId;
  /** The subject at that provider (Google `sub`, Apple `sub`, …). */
  readonly providerUserId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  /** Apple Hide My Email relay address. */
  readonly isPrivateEmail: boolean;
  /** Relay forwarding (Apple can switch it off from outside the app). */
  readonly emailForwarding: boolean;
  readonly name: string | null;
  /** ISO-8601. */
  readonly linkedAt: string;
  /** ISO-8601, or `null` when the service does not track it. */
  readonly lastSignInAt: string | null;
};
