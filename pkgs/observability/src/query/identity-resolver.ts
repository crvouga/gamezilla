import { normalizePersonName } from './person-name';

export type ResolvedIdentity = {
  readonly userId: string;
  readonly matchedAs: 'user_id' | 'username' | 'email' | 'name';
};

export interface IdentityResolver {
  resolve(identifier: string): Promise<ResolvedIdentity | null>;
  /** Every account that goes by this name. Optional so existing resolvers stay valid. */
  resolvePeople?(name: string): Promise<readonly ResolvedIdentity[]>;
}

export type IdentityLookup = (value: string) => Promise<string | null>;

/** Every account id that displays this name. The value is already normalized. */
export type NameLookup = (value: string) => Promise<readonly string[]>;

/**
 * Resolves operator-provided identity facts before querying telemetry. The
 * lookup functions own access to the product database; raw usernames, display
 * names and email addresses are never forwarded to a TraceStore.
 */
export class LookupIdentityResolver implements IdentityResolver {
  readonly #byUsername: IdentityLookup;
  readonly #byEmail: IdentityLookup;
  readonly #byName: NameLookup | undefined;

  constructor(lookups: {
    readonly byUsername: IdentityLookup;
    readonly byEmail: IdentityLookup;
    readonly byName?: NameLookup;
  }) {
    this.#byUsername = lookups.byUsername;
    this.#byEmail = lookups.byEmail;
    this.#byName = lookups.byName;
  }

  async resolve(identifier: string): Promise<ResolvedIdentity | null> {
    const people = await this.resolvePeople(identifier);
    return people[0] ?? null;
  }

  async resolvePeople(name: string): Promise<readonly ResolvedIdentity[]> {
    const value = name.trim();
    if (value.length === 0) return [];
    if (value.includes('@'))
      return this.#one(this.#byEmail, value.toLowerCase(), 'email');
    if (!value.includes(' ')) {
      const byUsername = await this.#one(
        this.#byUsername,
        value.toLowerCase(),
        'username'
      );
      if (byUsername.length > 0) return byUsername;
    }
    return this.#named(value);
  }

  async #one(
    lookup: IdentityLookup,
    value: string,
    matchedAs: ResolvedIdentity['matchedAs']
  ): Promise<readonly ResolvedIdentity[]> {
    const userId = await lookup(value);
    return userId === null ? [] : [{ userId, matchedAs }];
  }

  async #named(value: string): Promise<readonly ResolvedIdentity[]> {
    if (this.#byName === undefined) return [];
    const ids = unique(await this.#byName(normalizePersonName(value)));
    return ids.map((userId) => ({ userId, matchedAs: 'name' as const }));
  }
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
