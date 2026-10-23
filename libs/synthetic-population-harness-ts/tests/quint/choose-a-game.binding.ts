import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  givenSyntheticGameChoice,
  startSyntheticActivity,
  syntheticGameChoice,
} from '@libs/synthetic-population-harness-ts/game-choice-actions';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'choose-a-game',
  traces: 6,
  maxSteps: 6,
  verifySteps: 4,
  actions: {
    init: (w) => w.s.apply(givenSyntheticGameChoice, 'Cedar'),
    startNextActivity: (w, picks) =>
      w.s.apply(startSyntheticActivity, picks['choice'] as string),
    _keepLooking: () => Promise.resolve(),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, (picks['who'] as string).toLowerCase()),
    _comeBackOnline: (w, picks) =>
      w.s.apply(restoreActorConnection, (picks['who'] as string).toLowerCase()),
  },
  observe: (w) => w.quiet.read(syntheticGameChoice),
});
