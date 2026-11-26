import type { HarnessSlice } from '@libs/harness-ts/slices';
import { LIVE_REPORTING_CLIENT } from '@libs/observatory-client-ts/reporting-client';
import { OBSERVATORY_CLIENT } from '@libs/observatory-client-ts/sub-client';
import { createObservatoryAdminServer } from '@libs/observatory-server-ts/admin-server';
import { createLiveReportingServer } from '@libs/observatory-server-ts/sub-server';
import { OBSERVATORY_SUB } from '@libs/observatory-shared-ts/sub';
import { syntheticPopulationForObservatory } from '@libs/synthetic-population-server-ts/observatory-port';

/**
 * The User Observatory as deployed: every app reports that it is online now,
 * and the Synthetic Population says which of them are Synthetic Users.
 */
export const OBSERVATORY_HARNESS_SLICE: HarnessSlice = {
  name: 'observatory',
  sub: OBSERVATORY_SUB,
  client: { ...LIVE_REPORTING_CLIENT, ...OBSERVATORY_CLIENT },
  server: () => ({
    ...createObservatoryAdminServer(syntheticPopulationForObservatory),
    subs: [createLiveReportingServer(syntheticPopulationForObservatory)],
  }),
};
