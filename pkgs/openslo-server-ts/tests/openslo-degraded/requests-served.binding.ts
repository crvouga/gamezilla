/** The request fixture measured against a counter with an outage a quarter of an hour ago. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import {
  REQUEST_ALERTING,
  REQUESTS_NOW_MS,
  requestMeasures,
} from '../openslo/requests-product';

const MINUTE = 60_000;

bindObjectives({
  spec: 'requests-served',
  measure: requestMeasures({
    outage: {
      fromMs: REQUESTS_NOW_MS - 20 * MINUTE,
      toMs: REQUESTS_NOW_MS - 5 * MINUTE,
    },
  }),
  nowMs: () => REQUESTS_NOW_MS,
  alerting: REQUEST_ALERTING,
});
