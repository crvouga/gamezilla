# `@pkgs/billing`

The membership port: the only thing `@libs/billing` knows about billing, and
everything a payment provider must be able to do for us.

## The port

`MembershipBilling` has an identity and three methods, and speaks only our
vocabulary:

- `provider` — a lowercase slug (`stripe`, `paddle`, `mock`) that keys stored
  data: the projection row, the account's customer link (`billing:<provider>`)
  and the callback path (`<offer.callbackPath>/<provider>`). The app treats it
  as an opaque key and never compares it to a vendor name.
- `startCheckout({ accountId, customerId, email, returnUrl })` → the provider
  customer to remember plus where to send the person. `customerId` is the
  account's customer *at this provider*; `email` is the account's, when known
  (Paddle cannot mint a customer without one).
- `openPortal({ accountId, customerId, returnUrl })` → where the person manages
  their membership.
- `readCallback({ headers, rawBody })` → `unverified` | `ignored` | a
  `MembershipChange`. The adapter verifies authenticity itself; no signature
  scheme crosses the port.

## Several providers at once

`MembershipProviders` (`createMembershipProviders`) is what the app holds:
every configured adapter by id, and the one new checkouts go to. Switching
provider is a configuration change (`BILLING_PROVIDER` on the API Worker),
never a code change, and it can go either way any number of times:

- **Checkout** goes to the checkout provider — unless the account already has
  a live membership anywhere (`active`, `trialing`, `delinquent`), which is a
  409: two live memberships would bill one person twice.
- **Portal** opens where the account's governing membership lives, so a member
  who joined before a switch keeps managing it there.
- **Callbacks** arrive at `/api/billing/callback/<provider>`; only that
  provider's adapter reads them, and the customer they name is looked up only
  among that provider's customers.
- **Access** comes from the governing membership (`governingMembership`): the
  row granting the most — active over trialing over delinquent over
  incomplete over ended, then the later period end — never simply the newest, so a late "ended"
  callback from the old provider cannot hide a live membership at the new one.

## Provider modules

Composition roots never name a provider. Each provider package exports one
`MembershipProviderModule` of the same shape — its `provider` id, its
`secrets` (always optional: no provider is required), `create(env)` (the
adapter, or `null` when its credentials are absent) and, when its catalog is
not handed to it at boot, `reconcile(env)`. `@pkgs/billing-providers` holds
the one list (`MEMBERSHIP_PROVIDER_MODULES`: Stripe, Paddle, the mock), and
the API Worker (`createConfiguredMembershipProviders`), `billing:sync` and the
secret registry each iterate it. Adding, dropping or swapping a provider is an
edit to that list plus configuration; `tests/provider-modules.test.ts` there
builds every configured subset with each member taking checkouts. The
`import-billing-vendor` lint rule keeps every other product path off the
provider packages.

The offer is ours too: `catalogPriceId` / `catalogProductId` are the handles
providers find our catalog by, and `CancellationReason` is our vocabulary —
each provider translates them (Stripe's `lookup_key`, Paddle's
`custom_data.catalog_price_id`).

Retire a provider only once none of its memberships are live: without its
adapter the app can neither learn that one ended nor open its portal.

There is no catalog, no portal configuration, no reconcile and no price lookup
on the port. The offer we sell (`PlusMembershipOffer`, `offer.ts`) is deployment
data; reconciling it onto a vendor is a function in the vendor package
(`reconcileStripeOffer`, `reconcilePaddleOffer`), not a port method.
`billing:sync` reconciles every provider that has credentials.

## The status union

`MembershipStatus` is `incomplete | trialing | active | delinquent | ended`.
Every adapter maps its provider's states onto exactly these once; nothing
downstream — permissions, the client, the projection row — ever sees a vendor state such as `past_due`.

## The contract

`describeMembershipBillingContract` (`src/membership-billing-contract.ts`) is
the port as a test suite. Every implementation runs it with a harness over its
own provider's wire, and the assertions are identical:

| Implementation | Harness |
| --- | --- |
| `StripeMembershipBilling` (`@pkgs/billing-stripe`) | the real Stripe SDK over a fake Stripe REST origin |
| `MockMembershipBilling` (`@pkgs/billing-mock`) | a fake of the mock wire |
| `PaddleMembershipBilling` (`@pkgs/billing-paddle`) | the adapter over a fake Paddle REST origin |
| a made-up third provider (`membership.contract.test.ts`) | its own vocabulary and signature scheme |

It pins what the app relies on and nothing more: checkout mints or keeps a
customer; the portal opens; a callback that is unsigned, wrongly signed,
tampered or stale is `unverified`; an unrelated event is `ignored`; ten
provider-neutral situations (trial, paid, canceling, renewal failed, retries
exhausted, ended at period end, canceled immediately, first payment
incomplete / expired, paused) map to the same `Membership`; paused and
resumed callbacks project like any change; a duplicate or late delivery
reports the provider's **current** state, because every adapter re-reads the
subscription rather than trusting the payload — except that an *ended*
callback is final even when the re-read lags; a callback about a
subscription the provider does not know is `ignored`; and a provider outage
makes `readCallback` throw (so the delivery is retried) and a retry after it
succeeds.

A provider whose object model cannot express a situation declares it, with
the reason, instead of skipping it (`unreachable`): Paddle creates a
subscription only once its first payment settles, so it never holds an
incomplete one.

An `ended` membership's `periodEndMs` is when access ended — for an immediate
cancel that is the cancel time, not the period the person gave up.

## Implementations

- **Stripe** (`@pkgs/billing-stripe`) — the only place Stripe status names,
  event names and price lookup keys exist. `./harness` is a fake Stripe origin.
- **Paddle** (`@pkgs/billing-paddle`) — the only place Paddle status names,
  event names and custom-data keys exist. `./harness` is a fake Paddle origin.
- **Mock** (`@pkgs/billing-mock` adapter + `@pkgs/billing-mock-provider`) — a
  simulated payment provider with its own origin and state, Stripe's object
  model and lifecycle, signed webhooks and test clocks. Harnesses and the localhost
  stack bill through it; the app treats it exactly as any other provider.
