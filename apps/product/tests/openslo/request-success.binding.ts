/** Requests people make and changes they save, counted by the server's own metrics. */

import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'request-success',
    slis: ['people-requests-served', 'changes-saved-first-time'],
  })
);
