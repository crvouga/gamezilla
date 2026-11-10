import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  givenFindingOpponents,
  observeFindingOpponents,
  pauseAvailable,
  personGameEnds,
  personLooks,
  resumePaused,
  syntheticUserStarts,
} from '@libs/synthetic-population-harness-ts/finding-opponents-model';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'finding-opponents',
  traces: 12,
  maxSteps: 8,
  verifySteps: 4,
  timeoutMs: 240_000,
  actions: {
    init: (w, picks) =>
      w.s.apply(givenFindingOpponents, Number(picks['available'])),
    lookForOpponent: (w) => w.s.apply(personLooks),
    startNextActivity: (w) => w.s.apply(syntheticUserStarts),
    pause: (w) => w.s.apply(pauseAvailable),
    resume: (w) => w.s.apply(resumePaused),
    _finishGame: (w) => w.s.apply(personGameEnds),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['who']).toLowerCase()),
    _comeBackOnline: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['who']).toLowerCase()),
  },
  observe: (w) => w.quiet.read(observeFindingOpponents),
});
