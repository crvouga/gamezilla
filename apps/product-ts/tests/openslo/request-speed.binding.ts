/** How fast the app answers the requests people wait on, counted by the server's own metrics. */

import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives(
  liveMetricBinding({
    spec: 'request-speed',
    slis: [
      'saves-and-loads-answered-within-half-a-second',
      'saves-and-loads-answered-within-a-second',
      'sign-in-requests-answered-within-a-quarter-second',
      'sign-in-requests-answered-within-a-second',
      'people-requests-answered-within-two-and-a-half-seconds',
    ],
  })
);
