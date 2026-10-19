import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  givenSyntheticContinuity,
  observeSyntheticContinuity,
  reopenSyntheticApp,
  syntheticContinuity,
} from '@libs/synthetic-population-harness/continuity-actions';
import { renderQuint } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

type Continuity = Awaited<ReturnType<typeof syntheticContinuity>>;
bindQuintModel<QuintHarnessWorld>({
  model: 'synthetic-user-continuity',
  traces: 6,
  maxSteps: 6,
  verifySteps: 4,
  actions: {
    init: async (w, picks) => {
      await w.s.apply(
        givenSyntheticContinuity,
        renderQuint(picks['initialActivity']!),
        // The model names each game's Friday game `friday-<game id>`.
        String(picks['gameChoice']).replace(/^friday-/, '')
      );
      w.memo.set(
        'synthetic-population:continuity',
        await w.s.read(syntheticContinuity)
      );
    },
    reopenApp: (w) =>
      w.s.apply(
        reopenSyntheticApp,
        (w.memo.get('synthetic-population:continuity') as Continuity).board
          .gameId
      ),
    _loseConnection: (w) => w.s.apply(partition, 'cedar'),
    _comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'cedar'),
  },
  observe: (w) =>
    w.quiet.read(
      observeSyntheticContinuity,
      w.memo.get('synthetic-population:continuity') as Continuity
    ),
});
