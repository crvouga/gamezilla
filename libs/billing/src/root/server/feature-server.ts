/**
 * What billing contributes to a server: checkout, portal and webhook routes.
 *
 * The provider is a port on `ServerEnv`; billing reads it rather than
 * choosing one, so a simulation (the mock provider) and production (whichever
 * providers are configured) mount the same routes and take the same path.
 */

import { appAuth } from '@libs/auth/public/auth-context';
import { defineFeatureServer } from '@libs/feature/public/server';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { requirePermission } from '@libs/permissions/root/server/require-permission';
import { apiRequestAsyncLocalStorage } from '@libs/server-app/request-scope';
import { notifyUserChannels } from '@libs/server-app/sync/notify-user-channels';
import { assert } from '@pkgs/assert';
import type { MembershipProviders } from '@pkgs/billing';
import { createLogger } from '@pkgs/logger';
import type { CreateId } from '@pkgs/uuid/create-id';

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
  ) => notifyUserChannels([accountId], label, { tables, deferPublish: false });
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
 * configured provider — in production and in a sim alike.
 */
export function createBillingServer(billing: MembershipProviders | null) {
  return defineFeatureServer({
    name: 'billing',
    routes: (ctx) =>
      createBillingSubApp(billing, () => ctx.clock.now(), ctx.createId),
  });
}
