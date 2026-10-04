/**
 * The billing routes as the access table's server operations for
 * "subscribe" and "use the billing portal": the app's own billing sub-app
 * (its request guard included), answering a request inside the request
 * scope the API sets up, against the case's server database. When payments
 * are offered the deployment has one membership provider (a stub that
 * answers every checkout and portal request); when they are not it has none,
 * exactly as `billing_enabled` is derived on a real server.
 *
 * What is simulated: the session's resolution of the request to a caller
 * (the case's person, as the auth context reports them) and the provider.
 * Everything from the request guard to the provider call is the product's.
 */

import type { ApiRequestAsyncStore } from '@libs/app-root-shared/request-scope';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { AuthClaimAttr } from '@libs/auth-shared/auth-context';
import { billingCustomerLinkProvider } from '@libs/auth-shared/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth-shared/external-account-repository';
import type { SessionAuth } from '@libs/auth-shared/session-middleware';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { UnauthorizedError } from '@libs/auth-shared/unauthorized-error';
import { createBillingSubApp } from '@libs/billing-server/feature-server';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { paymentsOfferedOf } from '@libs/permissions-shared/people';
import type {
  ServerCase,
  ServerOperation,
} from '@libs/permissions-shared/server';
import { OperationRefused } from '@libs/permissions-shared/server';
import type { MembershipBilling } from '@pkgs/billing-root-shared/membership';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { Hono } from 'hono';

/** Everything the billing routes and the access decision read and write. */
export const BILLING_ROUTE_TABLES = [...BILLING_TABLES, ...AUTH_TABLES];

/** The deployment's provider id (the one a Plus member's membership is at). */
const PROVIDER = 'conformance';

/** Statuses the billing routes refuse with (auth, no customer, a live membership, off). */
const REFUSED = new Set([401, 404, 409, 503]);

const stubProvider: MembershipBilling = {
  provider: PROVIDER,
  cancelMembership: () =>
    Promise.reject(new Error('cancellation is outside this fixture')),
  readPayments: () => Promise.resolve([]),
  refundPayment: () =>
    Promise.reject(new Error('refund is outside this fixture')),
  startCheckout: (input) =>
    Promise.resolve({
      customerId: input.customerId ?? 'customer-new',
      url: 'https://pay.test/checkout',
    }),
  openPortal: () => Promise.resolve({ url: 'https://pay.test/portal' }),
  readCallback: () => Promise.resolve({ kind: 'ignored' }),
};

function providersFor(c: ServerCase): MembershipProviders | null {
  return paymentsOfferedOf(c.input)
    ? createMembershipProviders({ all: [stubProvider], checkout: PROVIDER })
    : null;
}

/** The caller the session resolves the request to: the case's person. */
function sessionFor(c: ServerCase): SessionAuth {
  const claims = {
    ...AuthClaimAttr.deviceId(c.env.deviceId),
    ...AuthClaimAttr.accountId(c.env.accountId ?? c.env.actorId),
    ...AuthClaimAttr.myId(c.env.actorId),
    ...AuthClaimAttr.isAnon(c.env.isAnon),
  };
  return {
    resolveAuthContext: () => Promise.resolve(claims),
  } as unknown as SessionAuth;
}

function requestStore(c: ServerCase): ApiRequestAsyncStore {
  return {
    sqlClient: c.db,
    sessionAuth: sessionFor(c),
    clock: { now: () => c.nowMs },
    createId: c.env.createId,
  } as unknown as ApiRequestAsyncStore;
}

/** The API's error handler: an auth refusal is a 401. */
function billingApp(c: ServerCase): Hono {
  return new Hono()
    .route(
      '/',
      createBillingSubApp(providersFor(c), () => c.nowMs, c.env.createId)
    )
    .onError((error, context) => {
      if (error instanceof UnauthorizedError) {
        return context.json({ error: error.message }, 401);
      }
      throw error;
    });
}

function postRoute(path: string): ServerOperation {
  return async (c) => {
    const response = await apiRequestAsyncLocalStorage.run(
      requestStore(c),
      () =>
        billingApp(c).request(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ returnUrl: 'https://app.test/more/billing' }),
        })
    );
    if (response.ok) return;
    if (REFUSED.has(response.status)) {
      throw new OperationRefused(`${path} answered ${String(response.status)}`);
    }
    throw new Error(`${path} failed with ${String(response.status)}`);
  };
}

/** Starting a membership: `POST /billing/checkout`. */
export const subscribe = postRoute('/billing/checkout');

/** Opening the membership portal: `POST /billing/portal`. */
export const openBillingPortal = postRoute('/billing/portal');

/**
 * An account is already the provider's customer (it paid once), so the
 * portal has somewhere to go: the case is about access, not about an
 * account that never paid.
 */
export async function seedBillingCustomer(c: ServerCase): Promise<void> {
  if (c.env.isAnon || c.env.accountId === null) return;
  await new ExternalAccountRepository(c.db).insertExternalAccountOrGet({
    userId: c.env.accountId,
    provider: billingCustomerLinkProvider(PROVIDER),
    externalId: 'customer-existing',
    now: () => c.nowMs,
    createId: c.env.createId,
  });
}
