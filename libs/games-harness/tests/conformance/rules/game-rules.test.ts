/**
 * The laws every turn game's rules keep, whatever the game: the shared
 * lifecycles hold, check, replay and show a game only through them.
 */

import { test } from 'bun:test';
import { gameRulesLaws } from '@libs/game-session-harness/game-rules-laws';
import { CONFORMANCE_GAMES } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  const others = CONFORMANCE_GAMES.filter((other) => other !== game);
  for (const law of gameRulesLaws(game, others))
    test(law.name, law.check, 60_000);
});
