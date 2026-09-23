# MVP acceptance contract

This suite is the user-readiness bar for the current product. It drives the real API, sessions, and database. Only the external identity provider and the billing provider are simulated. A build that passes every test under `apps/product/tests/acceptance` is ready for users on the scope below. The Google client id in that harness is `acceptance-google`. The Apple client id the signed identity token must carry is `acceptance-apple`.

The dev sign-in chooser is a simulator affordance and is not part of this contract.

## Assumptions

Identity is the pair `(provider, subject)`. Equal email addresses never merge accounts, including Apple Hide My Email relays. A later sign-in may omit email; the subject still resolves the same account. An unverified email fails closed and attaches to nobody.

Linking requires a live session for the target account and a successful provider callback for the identity being attached. An identity that already belongs to another account returns 409 and does not merge, move data, or switch the current session. Signing in without `intent=link` is the account switch. The last remaining sign-in method cannot be removed. Unlinking one of several methods keeps data on the account; the removed subject signs into a new empty account. Several Google subjects and several Apple subjects may sit on one account.

Sign-out revokes only that device session. OAuth exchange codes are single use. Redirects must match a trusted origin exactly. Provider outages fail closed: no session is minted, existing sessions stay valid, and a later attempt can succeed.

Billing entitlement is account-scoped and comes only from verified webhook events. The browser return from checkout does not grant access. Timestamps on the synced `billingSubscription` row (`billing_subscriptions`) are instants. Access while `now` is strictly before the boundary:

- `trialing` until `trial_end`
- `active` until `current_period_end`
- `past_due` until `grace_until`
- `canceled` until `current_period_end`
- `incomplete`, `incomplete_expired`, and `unpaid` never

`grace_until` is the provider event `created` time plus 7 days. A repeated failure in the same past-due episode does not move it later. A successful payment clears it. The next failure starts a new window. A delayed delivery still uses the event time. Checkout while entitled returns 409. After the paid period ends, checkout is allowed again. Checkout and portal return URLs must match a trusted origin. Missing or bad webhook signatures, tampered bodies, unknown customers, and events that name a different account than the customer binding return 400 and write nothing. Replayed event ids are idempotent.

The sim fixture secret `STRIPE_WEBHOOK_SECRET` (`acceptance-webhook-secret`) is what signature checks must use. `STRIPE_SECRET_KEY` is present so a provider adapter can boot. Neither value is a vendor credential.

Friend, space, profile, chess, and notification rules in the tests are the user-visible ones: authorization, soft-delete tombstones, case-insensitive usernames, own-only puzzle writes, and friend notifications delivered on the mutation. Sync protocol other than `3` returns `upgrade_required` and does not drop the account.

`bun check` and `bun deploy:prd` are unchanged. This directory is not its own pipeline task. Run it with the product test runner pointed at `tests/acceptance`.
