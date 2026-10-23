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
import { applyMembershipChange } from './apply-membership-change';

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
  checkout: Extract<StartCheckoutResult, { kind: 'live_membership' }>
): Promise<Response> {
  const { change } = checkout;
  if (
    change.provider === deps.provider.provider &&
    change.customerId === checkout.customerId &&
    (await applyMembershipChange({
      sql: deps.getSqlClient(),
      clock: deps.clock,
      accountId,
      change,
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
