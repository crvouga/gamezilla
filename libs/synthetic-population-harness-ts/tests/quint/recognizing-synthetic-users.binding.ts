import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  observeSyntheticIdentification,
  openSyntheticPopulationGame,
} from '@libs/synthetic-population-harness-ts/account-classification-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'recognizing-synthetic-users',
  traces: 6,
  maxSteps: 6,
  verifySteps: 4,
  actions: {
    init: async (w, picks) => {
      const game = picks['chosenGame'] as string;
      w.memo.set('synthetic-population:disclosure-game', game);
      await w.s.apply(givenSyntheticUser, 'Cedar', true, game);
      await w.s.apply(openSyntheticPopulationGame, 'bob', game);
    },
    openMultiplayer: (w) =>
      w.s.apply(
        openSyntheticPopulationGame,
        'bob',
        w.memo.get('synthetic-population:disclosure-game') as string
      ),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['who']).toLowerCase()),
    _comeBackOnline: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['who']).toLowerCase()),
  },
  observe: (w) => w.quiet.read(observeSyntheticIdentification),
});
