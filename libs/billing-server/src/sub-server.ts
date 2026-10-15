/**
 * What billing contributes to a server: checkout, portal and webhook routes.
 *
 * The provider is a port on `ServerEnv`; billing reads it rather than
 * choosing one, so a simulation (Stripe, simulated) and production (whichever
 * providers are configured) mount the same routes and take the same path.
 */

import { notifyUserChannels } from '@libs/app-root-server/notify-user-channels';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { appAuth } from '@libs/auth-shared/auth-context';
import { BILLING_TELEMETRY } from '@libs/billing-shared/telemetry';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { requirePermission } from '@libs/permissions-shared/require-permission';
import { defineSubServer } from '@libs/sub-shared/server';
import { assert } from '@pkgs/assert-root-shared/singleton';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import { createLogger } from '@pkgs/logger-shared/logger';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { registerBillingPrivacyConsumers } from './account-privacy-consumers';
import { BillingApp } from './billing-app';

export function createBillingSubApp(
  billing: MembershipProviders | null,
  now: () => number,
  createId: CreateId
) {
  const clock = { now };
  const getSqlClient = () => {
    const s = apiRequestAsyncLocalStorage.getStore();
    assert.defined(s, 'billing: request store missing');
    return s.sqlClient;
  };
  const notifyUser = (
    accountId: string,
    label: string,
    tables: readonly string[]
  ) => notifyUserChannels([accountId], label, { tables });
  return new BillingApp({
    getSqlClient,
    billing,
    requireAuth: async (_sql, req) => {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'billing auth: request store missing');
      const ctx = await s.sessionAuth.resolveAuthContext(s.sqlClient, req);
      const auth = appAuth(ctx);
      await requirePermission({
        db: s.sqlClient,
        auth,
        permission: PERMISSION.billingManage,
        nowMs: now(),
      });
      assert.defined(auth, 'billing auth: auth missing');
      assert.defined(auth.accountId, 'billing auth: account missing');
      return { accountId: auth.accountId, deviceId: auth.deviceId };
    },
    createId,
    clock,
    log: createLogger({ name: 'billing', now }),
    notifyUser,
  }).build();
}

/**
 * Billing needs the membership provider the host configured, so it is a
 * factory rather than a constant: the composition root hands it every
 * configured provider — in production and in a harness alike.
 */
export function createBillingServer(billing: MembershipProviders | null) {
  return defineSubServer({
    telemetryEvents: BILLING_TELEMETRY,
    name: 'billing',
    registerOutbox: (registry) =>
      registerBillingPrivacyConsumers(registry, billing),
    routes: (ctx) =>
      createBillingSubApp(billing, () => ctx.clock.now(), ctx.createId),
  });
}
