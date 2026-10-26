/** Measured by the metrics backend: see libs/observability-shared-ts/src/slo-indicators.ts. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'spaces-and-live-updates',
    slis: [
      'space-checks-passing',
      'live-update-checks-passing',
      'broker-pings-answered',
    ],
  })
);
