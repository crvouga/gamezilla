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
import firstMoveAbort from './fixtures/finding-opponents-first-move-abort.itf.json';
import pausedResumeAnswers from './fixtures/finding-opponents-paused-resume-answers.itf.json';
import syntheticGameFirstMoveAbort from './fixtures/finding-opponents-synthetic-game-first-move-abort.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'finding-opponents',
  traces: 12,
  maxSteps: 8,
  verifySteps: 4,
  timeoutMs: 240_000,
  regressions: [
    {
      // regression: finding-opponents-first-move-abort
      id: 'finding-opponents-first-move-abort',
      title: 'Two people matched together are still playing when a third looks',
      seed: '0x67932',
      itf: firstMoveAbort,
    },
    {
      // regression: finding-opponents-first-move-abort
      id: 'finding-opponents-synthetic-game-first-move-abort',
      title:
        'A person playing a Synthetic User is still playing when another looks',
      seed: '0x67932',
      itf: syntheticGameFirstMoveAbort,
    },
    {
      // regression: finding-opponents-paused-logout
      id: 'finding-opponents-paused-resume-answers',
      title:
        'A Synthetic User paused while a person looks answers them once resumed',
      seed: '0x67932',
      itf: pausedResumeAnswers,
    },
  ],
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
