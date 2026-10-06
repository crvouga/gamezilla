import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { joinMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import {
  changeSpaceMatch,
  prepareMultiplayerSpaceModel,
  readSpaceMatchModel,
} from '@libs/chess-root-harness/multiplayer-space-model';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { leaveSpace } from '@libs/spaces-harness/space-actions';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'multiplayer-spaces',
  traces: 32,
  maxSteps: 24,
  actions: {
    init: (w) => w.s.apply(prepareMultiplayerSpaceModel),
    joinSpace: (w, picks) =>
      w.s.apply(joinMultiplayerSpace, 'carol', String(picks['host'])),
    leaveSpace: (w) => w.s.apply(leaveSpace, 'carol'),
    openMultiplayer: (w) => w.s.apply(openMultiplayerChess, 'alice'),
    playMove: (w, picks) =>
      w.s.apply(changeSpaceMatch, String(picks['person']), 'move'),
    resignPlay: (w, picks) =>
      w.s.apply(changeSpaceMatch, String(picks['person']), 'resign'),
    loseConnection: (w) => w.s.apply(partition, 'carol'),
    comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'carol'),
  },
  observe: (w) => w.quiet.read(readSpaceMatchModel),
});
