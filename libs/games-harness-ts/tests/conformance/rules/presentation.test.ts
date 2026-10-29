/**
 * How the shared screens name every game: the game and each side by a name
 * of its own, every ending its rules reach — known lines and bounded play —
 * described and labelled, distinct endings never collapsed into one
 * description, a reason the game never gives left undescribed, and a draw on
 * time described whichever side ran out (naming that side, for a game that
 * can be drawn on time). Its frame tells each seat and the turn in every
 * position its rules reach, and lists each seat of a finished game once,
 * its winners first. The laws are `gamePresentationLaws` and
 * `gameFrameLaws`; faulty copies of the reference game prove each refuses
 * what it names (`reference-game/faulty-capabilities`).
 */

import { test } from 'bun:test';
import {
  gameFrameLaws,
  gamePresentationLaws,
} from '@libs/game-session-harness-ts/game-capability-laws';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  // regression: game-session-ending-descriptions-lost
  for (const law of gamePresentationLaws(game))
    test(law.name, law.check, 60_000);
  for (const law of gameFrameLaws(game)) test(law.name, law.check, 60_000);
});
