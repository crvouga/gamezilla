# `@pkgs/billing-mock-provider`

A **simulated payment provider** — not a stub. It is to `@pkgs/billing-mock`
what stripe.com is to `@pkgs/billing-stripe`: the other end of the wire.

It owns its customers, prices, payment methods, subscriptions, invoices,
checkout and portal sessions and events, in one SQLite database the caller
opens, and it serves:

| Path | Purpose |
| --- | --- |
| `/v1/customers`, `/v1/customers/:id` | create, read, set the default card |
| `/v1/prices?lookup_keys=` | the catalog, by lookup key |
| `/v1/checkout/sessions`, `…/:id`, `…/:id/expire` | hosted checkout sessions (24 h, pay once), expire by hand |
| `/v1/billing_portal/sessions` | hosted portal sessions (1 h) |
| `/v1/subscriptions`, `/v1/subscriptions/:id` | list (`status`, default excludes canceled), read, update (cancel at period end, switch price with `proration_behavior`), `DELETE` to cancel now |
| `/v1/subscriptions/:id/resume` | resume a paused subscription (new period, billed now) |
| `/v1/invoices`, `/v1/invoices/:id`, `/v1/invoices/:id/pay` | list (by customer / subscription), read, pay an open invoice |
| `/v1/refunds` | refund a paid invoice in full (`{ invoice }`) |
| `/v1/events`, `/v1/events/:id` | the event log |
| `/v1/test_helpers/customers/:id/advance_clock` | move one customer's test clock |
| `/v1/test_helpers/payment_methods/:id/expire` | let a card on file pass its expiry date |
| `/v1/test_helpers/events/:id/resend` | deliver an event again |
| `/c/pay/:id`, `/p/session/:id` | the hosted checkout and portal (Solid SPA) |
| `/pages/api/*` | what those pages call, authorized by their session id |

`/v1/*` needs `Authorization: Bearer <secret key>`, and speaks Stripe's
request conventions: bodies may be JSON or `application/x-www-form-urlencoded`
bracket encoding (`line_items[0][price]=…`); POSTs honour `Idempotency-Key`
(same key + same parameters replays the saved answer with
`Idempotent-Replayed: true`; different parameters are an `idempotency_error`;
validation failures are not saved; keys live 24 h); lists are newest first
with `limit` (1–100), `starting_after`, `ending_before` and `has_more`;
`expand[]` inlines `customer`, `latest_invoice`, `default_payment_method` and
`subscription` (`data.`-prefixed on lists); an unknown route is a 404 in the
`{ error }` envelope. Errors carry Stripe's types and statuses
(`invalid_request_error` 400/404, `authentication_error` 401, `card_error` 402
with `code` / `decline_code`, `idempotency_error` 400).

## Stripe's semantics

- **Checkout** grants a trial only when the session asks for one
  (`subscription_data.trial_period_days`). A trial is a $0 first invoice;
  without one the first charge must succeed or nothing is created. The page
  offers the portal's other prices as an upsell. Sessions report
  `payment_status` / `amount_total`, expire after 24 h on the customer's
  clock (`checkout.session.expired`), and with
  `payment_method_collection: if_required` a trial may start without a card.
- **A trial that ends without a card** follows
  `subscription_data.trial_settings.end_behavior.missing_payment_method`:
  `cancel` (the default), `pause` (`paused`, `customer.subscription.paused`;
  `/resume` starts a new period and bills it, `customer.subscription.resumed`)
  or `create_invoice` (billed anyway, so past due).
- **`customer.subscription.trial_will_end`** goes out three days before a
  trial ends (at once for a shorter trial), once per trial end.
- **Invoices** are created as drafts and finalized at once: numbered
  (`<customer>-0001`), `invoice.created` then `invoice.finalized`, then
  `invoice.paid` + `invoice.payment_succeeded`, `invoice.payment_failed`, or
  — for a card that needs 3D Secure off-session —
  `invoice.payment_action_required`. `subtotal`, `total`,
  `starting_balance`, `ending_balance`, `amount_due/paid/remaining` always
  add up.
- **Renewals** bill at each period end on a calendar month or year (Jan 31 →
  Feb 28). A declined charge leaves the invoice open and the subscription
  `past_due`, retried after 3, 5 and 7 days; after the last failure the
  subscription is canceled.
- **Cancel at period end** keeps access to the period end; **cancel now** ends
  it (`ended_at`) and keeps the old period on the object, as Stripe does.
- **Switching price** during a trial (or a pause) keeps the period;
  otherwise the period restarts now and the new price is invoiced at once
  with an `Unused time on …` proration credit line (none with
  `proration_behavior: none`). Credit beyond the new price stays on the
  customer's `balance` and pays later invoices, as on Stripe.
- **Dunning** retries only on schedule: paying by hand (the portal, or
  `/v1/invoices/:id/pay`) is an extra attempt that never moves the retry
  schedule or ends the subscription early.
- **A paused subscription** has no period to see out: `cancel_at_period_end`
  on it is refused; the portal's cancel ends it at once.
- **Test cards** are Stripe's magic payment methods: `pm_card_visa`,
  `pm_card_mastercard`, `pm_card_chargeCustomerFail` (attaches, then declines),
  `pm_card_chargeDeclined` (declines at once), `pm_card_authenticationRequired`
  (3D Secure: passes when the customer is present — checkout, the portal —
  and fails off-session renewals and API payments with
  `authentication_required`). Attaching a card emits
  `payment_method.attached` and `customer.updated`. Charges use the
  customer's default card (a simplification: Stripe would prefer the
  subscription's own `default_payment_method`).
- **Expired cards**: every charge checks the card's expiry against the
  customer's clock; a card past it declines with `expired_card`. The
  `expire` test helper moves a card's expiry to the month before the clock,
  as years on file would.
- **Refunds** pay a paid invoice back in full (`charge.refunded`). The mock
  has no charge objects, so the refund is recorded on the invoice
  (`amount_refunded`) and names its invoice and subscription. As on Stripe, a
  refund alone leaves the subscription as it is.
- **Test clocks** are per customer: billing time is the provider's clock plus
  that customer's offset, so advancing one customer a month runs their
  renewals and retries in order without moving anyone else.

## Webhooks

Every change records events (`customer.subscription.*` including `paused`,
`resumed` and `trial_will_end`, `invoice.*`, `checkout.session.completed` /
`expired`, `customer.created` / `updated`, `payment_method.attached`). They are delivered after
the change commits, on the injected timers, oldest first, signed at send time
(`billing-mock-signature`, Stripe's scheme). A non-2xx answer or an
unreachable endpoint is retried with backoff (1 s → 1 h). Duplicates and late
deliveries are normal; the adapter re-reads the subscription on every one.

## Its own face

The pages say **Mock Billing · test mode** (`src/shared/brand.ts`). The wire
is Stripe-shaped so the lifecycle is Stripe's; the identity is the mock's own,
so it never passes for Stripe.

## Running it

```ts
// In-process, on a virtual clock, as one node of a simulation.
const provider = await createMockBillingProvider({
  sqlClient, clock, timers, createId, fetch,
  origin: 'http://billing.sim',
  catalog: mockBillingCatalogFromOffer(offer),
  secretKey: 'sk_test_mock_…',
  webhook: { url: 'http://api/api/billing/callback', secret: 'whsec_…' },
});

// Standalone, on its own loopback port.
const handle = await startMockBillingProviderServer({ port: 0, catalog, secretKey, webhook });
```

## Tests

`tests/lifecycle.property.test.ts` is a model-based property test: random
sequences of checkouts (every test card, trial or not, card or not, each
missing-card behaviour), clock advances (hours to a year), cancel at period
end, renew, cancel now, prorated and unprorated switches, card changes,
off- and on-session payments, resumes and event resends run against the
provider (through the real adapter and its signed webhooks) and against a
reference model of Stripe's rules (`tests/support/reference-model.ts`).
After every step the subscriptions, balance and test clock must match the
model, every delivered webhook must verify and read as the model's
membership, and every invoice's arithmetic must add up with no invoice paid
twice. `tests/api.test.ts` pins the request conventions one by one.

`bun run stack` boots it beside the simulated Google and points every API node
at it with `BILLING_PROVIDER=mock`. `bun run build:web` rebuilds the embedded
pages (`src/server/assets.generated.ts`); `tests/assets.test.ts` fails when
they are stale.
