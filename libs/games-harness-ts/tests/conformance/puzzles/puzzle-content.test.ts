/**
 * Every game offering puzzles keeps its puzzles to itself, on the known
 * puzzles its harness names (`fixtures.puzzles`, written from the game's own
 * laws): each is one of its puzzles, in its own namespace; its validation
 * refuses every other game's known puzzle; its positions are recognised by
 * it alone; the catalogue admits each into its namespace and no other; and
 * a copy under another id is its duplicate. The laws are
 * `gamePuzzleContentLaws`; faulty copies of the reference game prove each
 * refuses what it names (`reference-game/faulty-games`).
 */

import { test } from 'bun:test';
import { gamePuzzleContentLaws } from '@libs/game-session-harness-ts/game-puzzle-laws';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { CONFORMANCE_GAMES } from '../../conformance-world';
import { forEveryTurnGame } from '../game-suite';

forEveryTurnGame(import.meta.path, (game) => {
  for (const law of gamePuzzleContentLaws(
    game,
    CONFORMANCE_GAMES.filter(isTurnHarnessGame)
  ))
    test(law.name, law.check);
});
