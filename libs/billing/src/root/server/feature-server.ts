/**
 * What billing contributes to a server: checkout, portal and webhook routes,
 * plus the fake provider's mock pages when that is what is configured.
 *
 * The provider is a port on `ServerEnv`; billing reads it rather than
 * choosing one, so a simulation and production mount the same routes.
 */

import { appAuth } from '@libs/auth/public/auth-context';
import { defineFeatureServer } from '@libs/feature/public/server';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { requirePermission } from '@libs/permissions/root/server/require-permission';
import { apiRequestAsyncLocalStorage } from '@libs/server-app/request-scope';
import { notifyUserChannels } from '@libs/server-app/sync/notify-user-channels';
import { assert } from '@pkgs/assert';
import { FakeMembershipBilling, type MembershipBilling } from '@pkgs/billing';
import type { CreateId } from '@pkgs/uuid/create-id';

import { PLUS_MEMBERSHIP_OFFER } from '../../public/offer';
import { BillingApp } from './billing-app';

export function createBillingSubApp(
  billing: MembershipBilling | null,
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
    notifyUser,
    // The mock edge exists only for the stateless fake; `instanceof` is why
    // the decision lives here rather than as a flag on the port.
    mock:
      billing instanceof FakeMembershipBilling
        ? {
            getSqlClient,
            offer: PLUS_MEMBERSHIP_OFFER,
            clock,
            createId,
            notifyUser,
          }
        : null,
  }).build();
}

/**
 * Billing needs the membership provider the host configured, so it is a
 * factory rather than a constant: the composition root hands it the port, the
 * same way a harness would hand it a fake.
 */
export function createBillingServer(billing: MembershipBilling | null) {
  return defineFeatureServer({
    name: 'billing',
    routes: (ctx) =>
      createBillingSubApp(billing, () => ctx.clock.now(), ctx.createId),
  });
}
