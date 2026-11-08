import { zValidator } from '@hono/zod-validator';
import { ExternalAccountRepository } from '@libs/auth-shared-ts/external-account-repository';
import type { BillingRouteDeps } from '@libs/billing-shared-ts/billing-route-deps';
import {
  billingNotConfigured,
  billingProviderUnavailable,
} from '@libs/billing-shared-ts/billing-route-deps';
import { CustomerLinks } from '@libs/billing-shared-ts/customer-links';
import { MembershipRepository } from '@libs/billing-shared-ts/membership-repository';
import type {
  MembershipBilling,
  MembershipChange,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared-ts/membership';
import {
  isMembershipLive,
  readMembershipStatus,
} from '@pkgs/billing-root-shared-ts/precedence';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { applyCurrentMembership } from './apply-membership-change';

const checkoutBodySchema = z.object({
  returnUrl: z.url(),
});

type CheckoutValidated = z.infer<typeof checkoutBodySchema>;

type CheckoutDeps = BillingRouteDeps & { readonly provider: MembershipBilling };

/** The provider's answer, or `null` when it could not give one. */
async function startAtProvider(
  deps: CheckoutDeps,
  input: StartCheckoutInput
): Promise<
  | { readonly ok: true; readonly result: StartCheckoutResult }
  | { readonly ok: false; readonly error: unknown }
> {
  try {
    return { ok: true, result: await deps.provider.startCheckout(input) };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Remembers the customer a first checkout minted. Two first checkouts at
 * once both mint one; the first to link wins, and the other checkout starts
 * again under the winner's customer — so both hand back the same checkout.
 */
async function linkFirstCustomer(
  c: Context,
  deps: CheckoutDeps,
  input: StartCheckoutInput,
  started: StartCheckoutResult
): Promise<StartCheckoutResult | Response> {
  const { provider } = deps;
  const outcome = await deps.getSqlClient().transaction((tx) =>
    new CustomerLinks(tx).link({
      accountId: input.accountId,
      provider: provider.provider,
      customerId: started.customerId,
      now: () => deps.clock.now(),
      createId: deps.createId,
    })
  );
  if (outcome.kind === 'taken') {
    // The provider answered with a customer another account holds: paying
    // through it would credit that account.
    deps.log.error('billing checkout: customer belongs to another account', {
      provider: provider.provider,
    });
    return c.json(
      { error: 'Billing customer belongs to another account' },
      409
    );
  }
  if (outcome.kind === 'already') {
    const again = await startAtProvider(deps, {
      ...input,
      customerId: outcome.customerId,
    });
    if (!again.ok) {
      return billingProviderUnavailable(c, deps.log, {
        provider: provider.provider,
        operation: 'checkout',
        error: again.error,
      });
    }
    return again.result;
  }
  // The customer link is a synced DOMAIN row (the client reads it to decide
  // whether a portal session is possible), so it needs its own push.
  await deps.notifyUser(input.accountId, 'billing:customer', [
    'auth_external_accounts',
  ]);
  return started;
}

/**
 * The provider already took the payment and its news has not reached the
 * app: project it now, through the same reading a callback gets, and open no
 * second checkout.
 */
async function membershipPending(
  c: Context,
  deps: CheckoutDeps,
  accountId: string,
  checkout: Extract<StartCheckoutResult, { kind: 'live_membership' }>,
  at: MembershipBilling = deps.provider
): Promise<Response> {
  const { change } = checkout;
  if (
    change.provider === at.provider &&
    change.customerId === checkout.customerId &&
    (await applyCurrentMembership({
      sql: deps.getSqlClient(),
      clock: deps.clock,
      accountId,
      change,
      read: () => at.readMembership(change.subscriptionId),
    }))
  ) {
    await deps.notifyUser(accountId, 'billing:membership', [
      'billing_subscriptions',
    ]);
  }
  return c.json(
    {
      error: 'A membership payment is still being confirmed',
      code: 'membership_pending',
    },
    409
  );
}

/**
 * Before a checkout opens at the provider new checkouts go to, every other
 * configured provider where the account is a customer closes the checkouts
 * it still has open, so a page left open there cannot take a second payment,
 * and reports a payment it took that the app has not heard of. A provider
 * that cannot answer opens no checkout anywhere: paying twice is worse than
 * trying again.
 */
async function settleOtherProviders(
  c: Context,
  deps: CheckoutDeps,
  accountId: string
): Promise<Response | null> {
  const links = new CustomerLinks(deps.getSqlClient());
  for (const other of deps.billing?.byId.values() ?? []) {
    if (other.provider === deps.provider.provider) continue;
    const customerId = await links.customerOf(accountId, other.provider);
    if (customerId === null) continue;
    let live: MembershipChange | null;
    try {
      live = await other.closeCheckouts(customerId);
    } catch (error) {
      return billingProviderUnavailable(c, deps.log, {
        provider: other.provider,
        operation: 'checkout',
        error,
      });
    }
    if (live !== null)
      return await membershipPending(
        c,
        deps,
        accountId,
        { kind: 'live_membership', customerId, change: live },
        other
      );
  }
  return null;
}

/**
 * Starts a membership at the provider new checkouts go to. An account that
 * is already a member — at any provider — manages that membership instead:
 * two live memberships would bill one person twice. So would a second
 * checkout: the provider hands back the one already open, and refuses while
 * a payment it took has not reached the app yet (`membership_pending`).
 */
async function handleBillingCheckout(
  c: Context,
  body: CheckoutValidated,
  deps: CheckoutDeps
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const governing = await new MembershipRepository(sql).governing(
    auth.accountId
  );
  if (
    governing !== null &&
    isMembershipLive(readMembershipStatus(governing.status))
  ) {
    return c.json({ error: 'This account already has a membership' }, 409);
  }
  const elsewhere = await settleOtherProviders(c, deps, auth.accountId);
  if (elsewhere !== null) return elsewhere;
  const { provider } = deps;
  const existing = await new CustomerLinks(sql).customerOf(
    auth.accountId,
    provider.provider
  );
  const input: StartCheckoutInput = {
    accountId: auth.accountId,
    customerId: existing,
    email: await new ExternalAccountRepository(sql).readAccountEmail(
      auth.accountId
    ),
    returnUrl: body.returnUrl,
  };
  const started = await startAtProvider(deps, input);
  if (!started.ok) {
    return billingProviderUnavailable(c, deps.log, {
      provider: provider.provider,
      operation: 'checkout',
      error: started.error,
    });
  }
  const checkout =
    existing === null
      ? await linkFirstCustomer(c, deps, input, started.result)
      : started.result;
  if (checkout instanceof Response) return checkout;
  if (checkout.kind === 'live_membership') {
    return await membershipPending(c, deps, auth.accountId, checkout);
  }
  if (checkout.url.length === 0) {
    return c.json({ error: 'Billing checkout URL missing' }, 502);
  }
  return c.json({ url: checkout.url }, 200);
}

export class BillingCheckoutRoutes {
  constructor(private readonly deps: BillingRouteDeps) {}

  build(): Hono {
    const deps = this.deps;
    return new Hono().post(
      '/billing/checkout',
      zValidator('json', checkoutBodySchema),
      async (c) => {
        if (deps.billing === null) return billingNotConfigured(c);
        return await handleBillingCheckout(c, c.req.valid('json'), {
          ...deps,
          provider: deps.billing.checkout,
        });
      }
    );
  }
}
