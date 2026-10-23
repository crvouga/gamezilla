import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { leaveSpace } from '@libs/spaces-harness-ts/space-actions';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import fixedColours from './fixtures/multiplayer-spaces-fixed-colours.itf.json';
import {
  changeSpacesMatch,
  prepareMatchedSpaces,
  readSpacesMatch,
} from './matched-game-spaces-world';
import { modelGameOf } from './model-game';

/** The model's people, each on the one device named after them. */
const PEOPLE = { alice: 'alice', bob: 'bob', carol: 'carol' } as const;

bindQuintModel<QuintHarnessWorld>({
  model: 'matched-game-spaces',
  traces: 32,
  maxSteps: 24,
  regressions: [
    {
      // regression: multiplayer-spaces-fixed-colours
      id: 'multiplayer-spaces-fixed-colours',
      title: 'The first moves use the sides named by the shared-space model',
      seed: '0x67932',
      itf: fixedColours,
    },
  ],
  actions: {
    init: (w) => prepareMatchedSpaces(w),
    joinSpace: (w, picks) =>
      w.s.apply(joinMultiplayerSpace, 'carol', String(picks['host'])),
    leaveSpace: (w) => w.s.apply(leaveSpace, 'carol'),
    openFindingAnOpponent: (w) =>
      w.s.apply(openFindingAnOpponent, 'alice', modelGameOf(w).shared.id),
    playMove: (w, picks) =>
      changeSpacesMatch(w, String(picks['person']), 'move'),
    resignGame: (w, picks) =>
      changeSpacesMatch(w, String(picks['person']), 'resign'),
    loseConnection: (w) => w.s.apply(partition, 'carol'),
    comeBackOnline: (w) => w.s.apply(restoreActorConnection, 'carol'),
  },
  observe: (w) => readSpacesMatch(w, PEOPLE),
});
