/** The request fixture measured against a healthy request counter. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import {
  REQUEST_ALERTING,
  REQUESTS_NOW_MS,
  requestMeasures,
} from './requests-product';

bindObjectives({
  spec: 'requests-served',
  measure: requestMeasures(),
  nowMs: () => REQUESTS_NOW_MS,
  alerting: REQUEST_ALERTING,
});
