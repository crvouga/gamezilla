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
| `/v1/checkout/sessions` | hosted checkout sessions (24 h, pay once) |
| `/v1/billing_portal/sessions` | hosted portal sessions (1 h) |
| `/v1/subscriptions`, `/v1/subscriptions/:id` | read, update (cancel at period end, switch price), `DELETE` to cancel now |
| `/v1/invoices`, `/v1/invoices/:id/pay` | read, pay an open invoice |
| `/v1/events`, `/v1/events/:id` | the event log |
| `/v1/test_helpers/customers/:id/advance_clock` | move one customer's test clock |
| `/v1/test_helpers/events/:id/resend` | deliver an event again |
| `/c/pay/:id`, `/p/session/:id` | the hosted checkout and portal (Solid SPA) |
| `/pages/api/*` | what those pages call, authorized by their session id |

`/v1/*` needs `Authorization: Bearer <secret key>`.

## Stripe's semantics

- **Checkout** grants a trial only when the session asks for one
  (`subscription_data.trial_period_days`). A trial is a $0 first invoice;
  without one the first charge must succeed or nothing is created. The page
  offers the portal's other prices as an upsell.
- **Renewals** bill at each period end on a calendar month or year (Jan 31 →
  Feb 28). A declined charge leaves the invoice open and the subscription
  `past_due`, retried after 3, 5 and 7 days; after the last failure the
  subscription is canceled.
- **Cancel at period end** keeps access to the period end; **cancel now** ends
  it (`ended_at`) and keeps the old period on the object, as Stripe does.
- **Switching price** during a trial keeps the trial; otherwise the period
  restarts now and the new price, minus credit for unused time, is charged at
  once.
- **Test cards** are Stripe's magic payment methods: `pm_card_visa`,
  `pm_card_mastercard`, `pm_card_chargeCustomerFail` (attaches, then declines),
  `pm_card_chargeDeclined` (declines at once).
- **Test clocks** are per customer: billing time is the provider's clock plus
  that customer's offset, so advancing one customer a month runs their
  renewals and retries in order without moving anyone else.

## Webhooks

Every change records events (`customer.subscription.*`, `invoice.*`,
`checkout.session.completed`, `customer.created`). They are delivered after
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

`bun run stack` boots it beside the simulated Google and points every API node
at it with `BILLING_PROVIDER=mock`. `bun run build:web` rebuilds the embedded
pages (`src/server/assets.generated.ts`); `tests/assets.test.ts` fails when
they are stale.
