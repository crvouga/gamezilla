export type ResolvedIdentity = {
  readonly userId: string;
  readonly matchedAs: 'user_id' | 'username' | 'email';
};

export interface IdentityResolver {
  resolve(identifier: string): Promise<ResolvedIdentity | null>;
}

export type IdentityLookup = (value: string) => Promise<string | null>;

/**
 * Resolves operator-provided identity facts before querying telemetry. The
 * lookup functions own access to the product database; raw usernames and
 * email addresses are never forwarded to a TraceStore.
 */
export class LookupIdentityResolver implements IdentityResolver {
  readonly #byUsername: IdentityLookup;
  readonly #byEmail: IdentityLookup;

  constructor(lookups: {
    readonly byUsername: IdentityLookup;
    readonly byEmail: IdentityLookup;
  }) {
    this.#byUsername = lookups.byUsername;
    this.#byEmail = lookups.byEmail;
  }

  async resolve(identifier: string): Promise<ResolvedIdentity | null> {
    const value = identifier.trim();
    if (value.length === 0) return null;
    const email = value.includes('@');
    const userId = email
      ? await this.#byEmail(value.toLowerCase())
      : await this.#byUsername(value.toLowerCase());
    if (userId === null) return null;
    return { userId, matchedAs: email ? 'email' : 'username' };
  }
}
