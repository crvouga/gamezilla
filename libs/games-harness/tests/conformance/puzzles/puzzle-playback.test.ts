/**
 * The platform's playback of every game's known puzzles: the line replays
 * as the game's rules play it (the setup position, the review board, the
 * shown solution), and a hint, a wrong move and a watcher's suggestion name
 * cells of the game's board. The laws are `gamePuzzlePlaybackLaws`.
 */

import { test } from 'bun:test';
import { gamePuzzlePlaybackLaws } from '@libs/game-session-harness/game-puzzle-laws';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  for (const law of gamePuzzlePlaybackLaws(game)) test(law.name, law.check);
});
