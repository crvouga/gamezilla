/**
 * How the shared screens name every game: the game and each side by a name
 * of its own, every ending its rules reach — known lines and bounded play —
 * described and labelled, distinct endings never collapsed into one
 * description, a reason the game never gives left undescribed, and a draw on
 * time described whichever side ran out (naming that side, for a game that
 * can be drawn on time). The laws are `gamePresentationLaws`; faulty copies
 * of the reference game prove each refuses what it names
 * (`reference-game/faulty-capabilities`).
 */

import { test } from 'bun:test';
import { gamePresentationLaws } from '@libs/game-session-harness-ts/game-capability-laws';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  // regression: game-session-ending-descriptions-lost
  for (const law of gamePresentationLaws(game))
    test(law.name, law.check, 60_000);
});
