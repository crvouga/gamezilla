/**
 * Several providers at once. The app may start new memberships at one
 * provider while members it signed up at another keep renewing, cancelling
 * and managing their membership there — during a migration, or for good.
 *
 * A switch is a configuration change, never a code change: which provider
 * new checkouts go to is {@link MembershipProviders.checkout}; every provider
 * the app still hears from and manages memberships at is in
 * {@link MembershipProviders.all}. Retire a provider only once none of its
 * memberships are live: without its adapter the app can neither learn that
 * one ended nor open its portal.
 */
import type { MembershipBilling } from './membership';
import type { PlusMembershipOffer } from './offer';

/** Every configured provider, and the one new checkouts start at. */
export type MembershipProviders = {
  /** Where a person with no live membership starts one. */
  readonly checkout: MembershipBilling;
  /** Every configured provider by its id, `checkout` included. */
  readonly byId: ReadonlyMap<string, MembershipBilling>;
};

/** Lowercase slug: safe in a URL path segment and a storage key. */
const PROVIDER_ID = /^[a-z][a-z0-9-]{0,31}$/;

export function isMembershipProviderId(value: string): boolean {
  return PROVIDER_ID.test(value);
}

/**
 * Builds the registry. Throws when two adapters claim one id, when an id is
 * not a slug, or when the checkout provider is not one of `all` — each would
 * route a callback, a customer or a portal to the wrong provider.
 */
export function createMembershipProviders(args: {
  readonly all: readonly MembershipBilling[];
  /** The id new checkouts go to. */
  readonly checkout: string;
}): MembershipProviders {
  const byId = new Map<string, MembershipBilling>();
  for (const billing of args.all) {
    if (!isMembershipProviderId(billing.provider)) {
      throw new Error(
        `billing: provider id '${billing.provider}' must be a lowercase slug`
      );
    }
    if (byId.has(billing.provider)) {
      throw new Error(
        `billing: two adapters claim provider id '${billing.provider}'`
      );
    }
    byId.set(billing.provider, billing);
  }
  const checkout = byId.get(args.checkout);
  if (checkout === undefined) {
    const known = [...byId.keys()].join(', ') || '(none)';
    throw new Error(
      `billing: checkout provider '${args.checkout}' is not configured (configured: ${known})`
    );
  }
  return { checkout, byId };
}

/**
 * Where provider `provider` must POST its callbacks, below the API origin.
 * One path per provider, so a delivery reaches exactly the adapter that can
 * verify it.
 */
export function membershipCallbackPath(
  offer: PlusMembershipOffer,
  provider: string
): string {
  if (!isMembershipProviderId(provider)) {
    throw new Error(
      `billing: provider id '${provider}' must be a lowercase slug`
    );
  }
  return `${offer.callbackPath}/${provider}`;
}
