# `@pkgs/billing-mock`

The mock payment provider's **adapter** for the membership port
(`@pkgs/billing`) — the peer of `@pkgs/billing-stripe`, built the same way:

| | Stripe | Mock |
| --- | --- | --- |
| Adapter | `StripeMembershipBilling` | `MockMembershipBilling` |
| Provider | stripe.com | `@pkgs/billing-mock-provider` (its own origin and state) |
| Reached over | HTTPS + secret key | HTTP + secret key |
| Learns changes from | signed webhooks (`stripe-signature`) | signed webhooks (`billing-mock-signature`) |
| Offer → catalog | `reconcileStripeOffer` (`billing:sync`) | `mockBillingCatalogFromOffer` (provider boot) |

The app holds a `MembershipBilling` and never asks which one. Both adapters
run `describeMembershipBillingContract` from `@pkgs/billing`, so "treated the
same" is a test, not a promise.

## The wire (`src/wire.ts`)

Stripe's object model and semantics, the mock's own identity: customers,
prices with lookup keys, subscriptions with Stripe's eight statuses and
item-level periods, invoices, checkout and portal sessions, events, the
`{ error: { type, code, message } }` envelope, Stripe's magic test payment
methods (`pm_card_visa`, `pm_card_chargeCustomerFail`, …), and a per-customer
test clock. Bodies are JSON; ids, host and the signature header are the mock's
own, so it never passes for Stripe.

## Signatures (`src/signature.ts`)

`billing-mock-signature: t=<unix s>,v1=<hex HMAC-SHA256(secret, "t.body")>` —
Stripe's scheme. Verified against the injected clock with a 300 s tolerance;
several `v1`s are accepted so a secret can roll.

## Callbacks

`readCallback` verifies the signature, then **re-reads the subscription** from
the provider rather than trusting the payload: the provider (like Stripe)
delivers duplicates and out of order. An `ended` membership reports when access
ended (`ended_at`), not the period it lost.
