import { test } from 'bun:test';
import { gameSimulationLaws } from '@libs/game-session-harness-ts/game-simulation-laws';
import { CONFORMANCE_GAMES } from '../../conformance-world';
import { forEverySimulationGame } from '../game-suite';

forEverySimulationGame(import.meta.path, (game) => {
  for (const law of gameSimulationLaws(
    game,
    CONFORMANCE_GAMES.filter((other) => other !== game)
  ))
    test(law.name, law.check);
});
