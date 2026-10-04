# `@pkgs/billing-paddle`

The Paddle Billing adapter for the membership port (`@pkgs/billing-shared`). The
counterpart of `@pkgs/billing-stripe`, and the only place a Paddle status
name, event name or custom-data key exists. It talks to Paddle's REST API
(`Paddle-Version: 1`) over an injected `fetch`, with no SDK, so it runs the
same on Workers, Bun and in tests.

## What it does

| Port | Paddle |
| --- | --- |
| `startCheckout` | mints a customer from the account's email (reusing the one Paddle already holds for it), creates a transaction for the offer's default price with the account stamped in `custom_data`, and returns the hosted checkout link (`PADDLE_CHECKOUT_URL` + `transaction_id`) or, without one, the account's default payment link (`?_ptxn=`) |
| `openPortal` | a customer portal session's overview link |
| `readCallback` | verifies `Paddle-Signature` (`ts=…;h1=…`, HMAC-SHA256 over `ts:body`, 5 s tolerance, several `h1` while a secret rolls), then re-reads the subscription so a late or duplicate delivery reports Paddle's current state; `subscription.canceled` is final |

Status mapping: `trialing` → trialing, `active` → active, `past_due` →
delinquent, `paused` / `canceled` / anything unknown → ended. A scheduled
cancel or pause is `endsAtPeriodEnd`. Paddle clears the billing period once a
subscription is paused or canceled, so an ended membership ends at
`canceled_at` / `paused_at` (or the period end, if earlier).

Paddle creates a subscription only once its first payment settles, so it
never reports an `incomplete` membership; the contract suite records those two
situations as unreachable, with that reason.

## Offer reconcile

`reconcilePaddleOffer` (`PADDLE_MEMBERSHIP_PROVIDER.reconcile`, run by
`billing:sync` when `PADDLE_API_KEY` is set)
converges the product, one price per offer price and the webhook destination,
finding each by the custom data it stamps (`catalog_product_id`,
`catalog_price_id`), never by Paddle id. Paddle prices are mutable, so amounts,
trials and regional prices update in place; a changed billing cycle archives
the old price and creates a new one. The offer prices regions by currency and
Paddle by country, so `PADDLE_CURRENCY_COUNTRIES` bridges them; a currency it
does not map is reported in `unpricedCurrencies` and those buyers pay the base
price. Paddle has no portal configuration API, so the offer's `portal` block
does not apply. A newly created destination's signing secret is never printed
(this runs in deploy logs): copy it from Paddle → Developer tools →
Notifications into `PADDLE_WEBHOOK_SECRET`.

## Secrets

All optional; a deployment bills through Paddle only when `PADDLE_API_KEY` is
set. The key's prefix picks sandbox (`pdl_sdbx_…`) or live (`pdl_live_…`).

| Secret | What |
| --- | --- |
| `PADDLE_API_KEY` | server-side API key |
| `PADDLE_WEBHOOK_SECRET` | the notification destination's secret (`pdl_ntfset_…`); without it callbacks fail closed |
| `PADDLE_CHECKOUT_URL` | a hosted checkout link (`https://pay.paddle.io/hsc_…`); set its success redirect to the app's billing screen in the dashboard |

With Stripe also configured, set `BILLING_PROVIDER` on the API Worker to the
one new checkouts go to; members of the other keep being served there.

## Tests

- `../billing-paddle-harness/tests/paddle-membership.contract.test.ts` — the shared membership contract
  over `FakePaddle` (`@pkgs/billing-paddle/harness`), an in-memory Paddle origin
  with Paddle's envelopes, errors, pagination and webhook signatures.
- `../billing-paddle-harness/tests/paddle-membership.test.ts` — signatures (property-based), checkout
  links, customer reuse, pagination, auth failures.
- `../billing-paddle-harness/tests/offer-reconcile.test.ts` — create, no-op rerun, in-place update,
  cycle change, moved destination.
- `@libs/billing` `tests/multi-provider.test.ts` runs this adapter and the
  Stripe one side by side behind the real routes.
