/** How fast the app answers the requests people wait on, counted by the server's own metrics. */

import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'request-speed',
    slis: [
      'people-requests-answered-within-half-a-second',
      'people-requests-answered-within-two-and-a-half-seconds',
    ],
  })
);
