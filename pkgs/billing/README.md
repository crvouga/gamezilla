# `@pkgs/billing`

The membership port: the only thing `@libs/billing` knows about billing, and
everything a payment provider must be able to do for us.

## The port

`MembershipBilling` has three methods and speaks only our vocabulary:

- `startCheckout({ accountId, customerId, returnUrl })` → the provider customer
  to remember plus where to send the person.
- `openPortal({ accountId, customerId, returnUrl })` → where the person manages
  their membership.
- `readCallback({ headers, rawBody })` → `unverified` | `ignored` | a
  `MembershipChange`. The adapter verifies authenticity itself; no signature
  scheme crosses the port.

There is no catalog, no portal configuration, no reconcile and no price lookup
on the port. The offer we sell (`PlusMembershipOffer`, `offer.ts`) is deployment
data; reconciling it onto a vendor is a function in the vendor package
(`@pkgs/billing-stripe` `reconcileStripeOffer`), not a port method.

## The status union

`MembershipStatus` is `incomplete | trialing | active | delinquent | ended`.
Every adapter maps its provider's states onto exactly these once; nothing
downstream — `@pkgs/entitlements`' `resolveTier`, the client, the projection
row — ever sees a vendor state such as `past_due`.

## The fake

`FakeMembershipBilling` is the reference implementation and is **stateless**: it
mints `fake_cus_<accountId>` and points checkout/portal at the app's own
dev-only mock routes, which compute each change from the request plus the
account's current projection row. No provider state means every instance agrees
without coordination — safe for the localhost stack's N API nodes. It has no
signed callbacks, so `readCallback` always reports `unverified`.

The Stripe adapter (`@pkgs/billing-stripe` `StripeMembershipBilling`) is the
only place Stripe status names, event names and price lookup keys exist.
