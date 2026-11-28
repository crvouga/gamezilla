import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { liveMetricBinding } from './live-metrics';

bindObjectives({
  ...liveMetricBinding({
    spec: 'using-the-tabs',
    slis: ['first-opening-checks-passing', 'reopening-checks-passing'],
  }),
  whenNoEvidence: 'fail',
});
