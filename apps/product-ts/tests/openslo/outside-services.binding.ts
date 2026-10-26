/** Measured by the metrics backend: see libs/observability-shared-ts/src/slo-indicators.ts. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'outside-services',
    slis: ['outside-service-checks-passing'],
  })
);
