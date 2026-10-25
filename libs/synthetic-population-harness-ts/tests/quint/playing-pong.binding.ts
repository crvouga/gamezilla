import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { syntheticContinuity } from '@libs/synthetic-population-harness-ts/continuity-actions';
import {
  continueSyntheticActivity,
  observeOngoingActivity,
} from '@libs/synthetic-population-harness-ts/ongoing-activity-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

type Initial = Awaited<ReturnType<typeof syntheticContinuity>>;
bindQuintModel<QuintHarnessWorld>({
  model: 'playing-pong',
  traces: 6,
  maxSteps: 6,
  verifySteps: 4,
  actions: {
    init: async (w) => {
      await w.s.apply(givenSyntheticUser, 'Cedar', true, 'Pong');
      w.memo.set(
        'synthetic-population:playing-pong',
        await w.s.read(syntheticContinuity)
      );
    },
    continueActivity: (w) => w.s.apply(continueSyntheticActivity),
    _loseConnection: (w) => w.s.apply(partition, 'cedar'),
    _comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'cedar'),
  },
  observe: (w) =>
    w.quiet.read(
      observeOngoingActivity,
      w.memo.get('synthetic-population:playing-pong') as Initial
    ),
});
