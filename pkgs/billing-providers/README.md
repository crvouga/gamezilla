# `@pkgs/billing-providers`

The one list of membership providers this product can bill through
(`MEMBERSHIP_PROVIDER_MODULES`: Stripe, Paddle, the mock), and the helpers
composition roots use to iterate it:

- `createConfiguredMembershipProviders({ env, chooseCheckout })` — builds every
  provider whose credentials are set and registers them as
  `MembershipProviders`; a module that is misconfigured fails as
  `MembershipProviderConfigError`, naming itself.
- `membershipSecretReader(secretStore)` — the `readSecret` modules build from.

The API Worker, `billing:sync` and the secret registry import this package and
never a provider package, so adding, dropping or swapping a provider is an
edit to the list plus configuration. `tests/provider-modules.test.ts` pins the
interchangeability: unique slug ids, colliding-free and optional secrets,
nothing built when unconfigured, an adapter answering to its module's id, and
every configured subset working with each member taking checkouts.
