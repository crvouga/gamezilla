/** Measured by the metrics backend: see libs/observability-server-ts/src/slo-indicators.ts. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'receiving-bug-reports',
    slis: ['bug-report-checks-passing'],
  })
);
