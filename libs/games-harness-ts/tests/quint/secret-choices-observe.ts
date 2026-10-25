/**
 * The secret-choices model's state as people are shown it: the custom game
 * as everyone online sees it (the observer's screen), which sides each
 * person's own screen shows chosen, and whose secret choice each person's
 * own screen shows them.
 */

import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  CHOICE_PEOPLE,
  choicePeople,
  modelSide,
  probeOf,
  shownGame,
} from './secret-choices-world';

/** Who plays each model side, as the custom game shows its seats. */
function participantsOf(w: QuintHarnessWorld, game: CustomGame) {
  return new Map(
    game.sides.map((side) => [
      modelSide(w, side),
      game[side].kind === 'bot'
        ? 'bot'
        : (choicePeople(w).get(game[side].person) ?? 'unknown'),
    ])
  );
}

/** What each person's own screen shows: the sides chosen, and their own secret choice. */
async function shownToEach(w: QuintHarnessWorld) {
  const chosenShown = new Map<string, Set<string>>();
  const secretChoiceShown = new Map<string, Set<string>>();
  for (const person of CHOICE_PEOPLE) {
    const probe = await probeOf(w, person);
    const game = probe.current;
    const awaited = game?.status === 'active' && game.awaiting.length > 0;
    chosenShown.set(
      person,
      new Set(awaited ? game.committed.map((side) => modelSide(w, side)) : [])
    );
    secretChoiceShown.set(
      person,
      new Set(
        awaited && probe.ownCommitment !== null && probe.mySide !== null
          ? [modelSide(w, probe.mySide)]
          : []
      )
    );
  }
  return { chosenShown, secretChoiceShown };
}

export async function observeChoiceModel(w: QuintHarnessWorld) {
  const game = await shownGame(w);
  return {
    participants: participantsOf(w, game),
    status: game.status === 'completed' ? 'finished' : 'under way',
    choosing: game.status === 'active' && game.awaiting.length > 0,
    ...(await shownToEach(w)),
    standIn: new Set(game.standIns.map((side) => modelSide(w, side))),
    result: game.status === 'completed' ? 'decided' : '',
  };
}
