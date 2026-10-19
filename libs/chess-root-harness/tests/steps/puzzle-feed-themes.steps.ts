/**
 * Chess's own puzzle themes in the feed ("fork"): a pool stocked with chess
 * puzzles with and without one, and the feed limited to it. How every
 * game's feed is customized is the Games context's (`@libs/games-harness`
 * puzzle steps).
 */

import { expect } from 'bun:test';
import { readServerPuzzles } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { GOOD_PUZZLE } from '@libs/chess-puzzle-harness/puzzle-pool-stock';
import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import { isChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  closePuzzleFeedSettings,
  closePuzzleFeedSettingsNoWait,
  openPuzzleFeedSettings,
  setPuzzleFeedTheme,
} from '@libs/game-session-harness/puzzle-feed';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { servedPuzzle, stock, trackPuzzle } from './puzzle-world';

function chessTheme(name: string): ChessPuzzleTheme {
  if (!isChessPuzzleTheme(name)) throw new Error(`no chess theme "${name}"`);
  return name;
}

Given(
  'the puzzle pool holds puzzles with and without the {string} theme',
  async (w, name: string) => {
    const theme = chessTheme(name);
    await stock(
      w,
      [1480, 1500, 1520].map((rating) => ({
        ...GOOD_PUZZLE,
        rating,
        themes: [theme],
      }))
    );
    // Precondition guard: the pool holds both kinds.
    const withTheme = (await w.s.read(readServerPuzzles)).map((row) =>
      (typeof row.themes === 'string'
        ? row.themes
        : JSON.stringify(row.themes)
      ).includes(`"${theme}"`)
    );
    expect(withTheme).toContain(true);
    expect(withTheme).toContain(false);
  }
);

When(
  '{actor} limits the feed to the {string} theme',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, CHESS_GAME_ID, chessTheme(name));
    await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
  }
);

Given(
  '{actor} has limited the feed to the {string} theme',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, CHESS_GAME_ID, chessTheme(name));
    await w.s.apply(closePuzzleFeedSettings, actor);
    await trackPuzzle(w, actor);
  }
);

Then(
  '{actor} is served a puzzle with the {string} theme',
  async (w, actor: Actor, name: string) => {
    const theme = chessTheme(name);
    await servedPuzzle(w, actor, (debug) => debug.themes.includes(theme));
  }
);

Then(
  '{actor} is not offered a puzzle without the {string} theme',
  async (w, actor: Actor, name: string) => {
    const served = await servedPuzzle(w, actor);
    expect(served.themes).toContain(chessTheme(name));
  }
);
