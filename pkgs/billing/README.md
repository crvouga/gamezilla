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

## The contract

`describeMembershipBillingContract` (`src/membership-billing-contract.ts`) is
the port as a test suite. Every implementation runs it with a harness over its
own provider's wire, and the assertions are identical:

| Implementation | Harness |
| --- | --- |
| `StripeMembershipBilling` (`@pkgs/billing-stripe`) | the real Stripe SDK over a fake Stripe REST origin |
| `MockMembershipBilling` (`@pkgs/billing-mock`) | a fake of the mock wire |
| a made-up third provider (`membership.contract.test.ts`) | its own vocabulary and signature scheme |

It pins what the app relies on and nothing more: checkout mints or keeps a
customer; the portal opens; a callback that is unsigned, wrongly signed,
tampered or stale is `unverified`; an unrelated event is `ignored`; ten
provider-neutral situations (trial, paid, canceling, renewal failed, retries
exhausted, ended at period end, canceled immediately, first payment
incomplete / expired, paused) map to the same `Membership`; and a duplicate or
late delivery reports the provider's **current** state, because every adapter
re-reads the subscription rather than trusting the payload.

An `ended` membership's `periodEndMs` is when access ended — for an immediate
cancel that is the cancel time, not the period the person gave up.

## Implementations

- **Stripe** (`@pkgs/billing-stripe`) — production. The only place Stripe
  status names, event names and price lookup keys exist.
- **Mock** (`@pkgs/billing-mock` adapter + `@pkgs/billing-mock-provider`) — a
  simulated payment provider with its own origin and state, Stripe's object
  model and lifecycle, signed webhooks and test clocks. Sims and the localhost
  stack bill through it; the app treats it exactly as it treats Stripe.
