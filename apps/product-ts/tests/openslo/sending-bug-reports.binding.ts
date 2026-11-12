/** Measured by the metrics backend: see libs/observability-server-ts/src/slo-indicators.ts. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'sending-bug-reports',
    slis: [
      'bug-reports-taken',
      'bug-reports-answered-within-five-seconds',
      'bug-reports-answered-within-ten-seconds',
    ],
  })
);
