/**
 * `specs/billing/access.dmn` against the permission system:
 *
 * - application decision — the kernel's decision for the case's person
 *   (facts from the product's resolver, the billing switch from the case),
 *   answer and reason;
 * - server enforcement — the operation the capability is performed through,
 *   against the case's server database: the billing routes for subscribing
 *   and the portal; the request guard the notifications and matchmaking
 *   routes run; the people search query's authorize hook; for every
 *   capability mutations perform, the replay's authorize hook for each of
 *   those mutations. "See the billing plans" has no server boundary (the
 *   plans ship with the app), so this layer does not govern it;
 * - client gating — the live decision the app renders each feature, its lock
 *   or its unlock from (`useDecision`), on the person's device with the
 *   synced rows behind the case; answer and reason.
 */

import { BILLING_TABLES } from '@libs/billing/public/schema';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { accessApplicationLayer } from '@libs/permissions/root/conformance/application';
import { accessClientLayer } from '@libs/permissions/root/conformance/client-layers';
import {
  queryGuardOperation,
  routeGuardOperation,
} from '@libs/permissions/root/conformance/server';
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
        'use people search': queryGuardOperation(PERMISSION.peopleSearch),
      },
      ungoverned: {
        // The plans are the offer compiled into the app (`PLUS_MEMBERSHIP_OFFER`),
        // never fetched: there is nothing on the server to refuse. Subscribing
        // to one is the checkout route, governed above.
        'see the billing plans':
          'no server boundary: the plans are app data, not served',
      },
    }),
    'client gating': accessClientLayer({ tables: BILLING_TABLES }),
  },
});
