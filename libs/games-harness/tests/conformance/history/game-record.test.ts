/**
 * The game record of every game whose matched games offer one (finding an
 * opponent and history): read back in the game's own format, it names both
 * people on their sides, the result, the clock choice and every move of
 * this game. A game offering history without matched games writes no
 * record anyone copies, so it owes none here. The law is `gameRecordLaws`;
 * faulty copies of the reference game prove it refuses a wrong record
 * (`reference-game/faulty-capabilities`).
 */

import { test } from 'bun:test';
import { gameRecordLaws } from '@libs/game-session-harness/game-capability-laws';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
    for (const law of gameRecordLaws(game)) test(law.name, law.check, 60_000);
  },
  ['matchmaking']
);
