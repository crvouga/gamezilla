/**
 * Bots of every game offering custom games choose only legal actions at
 * every strength they offer — or the one bot's, when they offer none —
 * and stop exactly when the game has finished.
 */

import { test } from 'bun:test';
import { gameBotLaws } from '@libs/game-session-harness-ts/game-rules-laws';
import { forEveryTurnGame } from '../game-suite';

forEveryTurnGame(import.meta.path, (game) => {
  for (const law of gameBotLaws(game)) test(law.name, law.check, 60_000);
});
