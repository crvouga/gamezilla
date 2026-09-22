/** One sign-in method on an account, as `/auth/identities` reports it. */
export type AuthIdentity = {
  readonly provider: string;
  readonly providerUserId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  /** Apple Hide My Email relay address. */
  readonly isPrivateEmail: boolean;
  /** Relay forwarding (Apple can switch it off from outside the app). */
  readonly emailForwarding: boolean;
  readonly name: string | null;
  readonly linkedAt: string;
  readonly lastSignInAt: string | null;
};
