import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  bobLeavesGame,
  cedarMovesOnce,
  observeHumanLikePlay,
  rematchOffered,
} from '@libs/synthetic-population-harness-ts/human-like-play-model';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'human-like-play',
  traces: 8,
  maxSteps: 6,
  verifySteps: 4,
  timeoutMs: 240_000,
  actions: {
    init: (w) => w.s.apply(givenSyntheticUser, 'Cedar', true, 'chess'),
    continueActivity: (w) => w.s.apply(cedarMovesOnce),
    _finishGame: (w) => w.s.apply(bobLeavesGame),
    offerRematch: (w, picks) =>
      w.s.apply(
        rematchOffered,
        String(picks['who']),
        picks['accepted'] === true
      ),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['who']).toLowerCase()),
    _comeBackOnline: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['who']).toLowerCase()),
  },
  observe: (w) => w.quiet.read(observeHumanLikePlay),
});
