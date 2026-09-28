/**
 * `specs/billing/access.dmn` against the permission system:
 *
 * - application decision — the kernel's decision for the case's person
 *   (facts from the product's resolver, the billing switch from the case),
 *   answer and reason;
 * - server enforcement — the operation the capability is performed through,
 *   against the case's server database: the billing routes for subscribing
 *   and the portal; the request guard the notifications and matchmaking
 *   routes run; for every capability mutations perform, the replay's
 *   authorize hook for each of those mutations. "See the billing plans" and
 *   "use people search" have no server operation that decides them, so this
 *   layer does not govern them.
 */

import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { accessApplicationLayer } from '@libs/permissions/root/conformance/application';
import { routeGuardOperation } from '@libs/permissions/root/conformance/server';
import { accessServerLayer } from '@libs/permissions/root/conformance/server-layers';
import { bindDecisions } from '@pkgs/dmn/registry';

import {
  BILLING_ROUTE_TABLES,
  openBillingPortal,
  seedBillingCustomer,
  subscribe,
} from './billing-routes';

bindDecisions({
  spec: 'access',
  layers: {
    'application decision': accessApplicationLayer(),
    'server enforcement': accessServerLayer({
      tables: BILLING_ROUTE_TABLES,
      seed: seedBillingCustomer,
      routes: {
        subscribe,
        'use the billing portal': openBillingPortal,
        'get notifications': routeGuardOperation(
          PERMISSION.notificationsReceive
        ),
        'wait for a match': routeGuardOperation(PERMISSION.matchmakingUse),
      },
    }),
  },
});
