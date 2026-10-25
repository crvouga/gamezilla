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
  decidedChoices,
  MODEL_SIDES,
  madeChoiceName,
  modelSide,
  movesSinceRound,
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

/**
 * Each model side's secret choice in the open round: its person's own, as
 * their screen shows it and named as the binding made it; a bot's or
 * stand-in's, which nobody is shown, as the trace named it once it is shown
 * chosen.
 */
async function secretChoicesOf(
  w: QuintHarnessWorld,
  game: CustomGame,
  people: Readonly<Record<string, string>>
) {
  const choices = new Map<string, string>();
  for (const side of game.sides) {
    const named = modelSide(w, side);
    const person = people[named];
    const own =
      person === undefined ? null : (await probeOf(w, person)).ownCommitment;
    const chosen = game.committed.includes(side);
    choices.set(
      named,
      own !== null
        ? (madeChoiceName(w, named, own) ?? own)
        : chosen
          ? (decidedChoices(w).get(named) ?? 'unknown')
          : ''
    );
  }
  return choices;
}

/** What each person's own screen shows: the sides chosen, and their own choice. */
async function shownToEach(w: QuintHarnessWorld) {
  const chosenShown = new Map<string, Set<string>>();
  const secretChoiceShown = new Map<string, Set<string>>();
  for (const person of CHOICE_PEOPLE) {
    const probe = await probeOf(w, person);
    const game = probe.current;
    chosenShown.set(
      person,
      new Set(
        game?.status === 'active' && game.awaiting.length > 0
          ? game.committed.map((side) => modelSide(w, side))
          : []
      )
    );
    secretChoiceShown.set(
      person,
      new Set(
        probe.ownCommitment !== null && probe.mySide !== null
          ? [modelSide(w, probe.mySide)]
          : []
      )
    );
  }
  return { chosenShown, secretChoiceShown };
}

export async function observeChoiceModel(
  w: QuintHarnessWorld,
  people: Readonly<Record<string, string>>
) {
  const game = await shownGame(w);
  const choosing = game.status === 'active' && game.awaiting.length > 0;
  const { rounds, since } = movesSinceRound(w, game);
  return {
    participants: participantsOf(w, game),
    status: game.status === 'completed' ? 'finished' : 'under way',
    choiceRound: rounds + (choosing ? 1 : 0),
    choosing,
    secretChoice: choosing
      ? await secretChoicesOf(w, game, people)
      : new Map(MODEL_SIDES.map((side) => [side, ''])),
    ...(await shownToEach(w)),
    appliedRounds: rounds,
    standIn: new Set(game.standIns.map((side) => modelSide(w, side))),
    movesThisRound: choosing ? 0 : since,
    result: game.status === 'completed' ? 'decided' : '',
  };
}
