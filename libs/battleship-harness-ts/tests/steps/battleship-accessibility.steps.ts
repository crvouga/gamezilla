/**
 * Battleship with the keyboard alone and by listening, and with reduced
 * motion: the same gestures and boards, read the way such a person meets
 * them.
 */

import { expect } from 'bun:test';
import {
  chooseBattleshipTarget,
  listenToBattleship,
  preferBattleshipReducedMotion,
  shootBattleship,
} from '@libs/battleship-harness-ts/battleship-actions';
import { SIDE_NAMES } from '@libs/battleship-harness-ts/battleship-fixtures';
import {
  battleshipHeard,
  shotCells,
} from '@libs/battleship-harness-ts/battleship-view';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  type BattleshipWorld,
  cellNamed,
  remembered,
  sees,
  shipNamed,
  sideOf,
} from './battleship-world';

const SETTLE_MS = 10_000;
/** How the board says what a shot found. */
const FOUND = { hit: 'hit', miss: 'missed' } as const;

/** What `actor` hears once it includes `words`. */
function hears(w: BattleshipWorld, actor: string, words: RegExp) {
  return w.s.until((s) => battleshipHeard(s, actor), {
    maxMs: SETTLE_MS,
    pred: (heard) => words.test(heard),
  });
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

Given('{actor} is listening to the app', async (w, actor: string) => {
  await w.s.apply(listenToBattleship, actor);
});
Given('{actor} prefers reduced motion', async (w, actor: string) => {
  await w.s.apply(preferBattleshipReducedMotion, actor);
});

When(
  '{actor} shoots at {word} with the keyboard',
  async (w, actor: string, cell: string) => {
    await w.s.apply(shootBattleship, actor, cellNamed(cell), true);
  }
);
When(
  '{actor} chooses {word} on her targeting board with the keyboard',
  async (w, actor: string, cell: string) => {
    await w.s.apply(chooseBattleshipTarget, actor, cellNamed(cell));
  }
);

Then(
  '{actor} cannot shoot at {word} again',
  async (w, actor: string, cell: string) => {
    const view = await sees(w, actor);
    const target = view.target[cellNamed(cell)];
    expect(target?.enabled).toBe(false);
    expect(target?.label).not.toStartWith('Fire at');
    expect(view.screen.current?.moves).toEqual(
      remembered(w, actor).screen.current?.moves
    );
  }
);
Then(
  '{actor} hears her shot at {word} is a {word}',
  async (w, actor: string, cell: string, result: string) => {
    const found = FOUND[result as keyof typeof FOUND];
    expect(found).toBeDefined();
    await hears(
      w,
      actor,
      new RegExp(`You fired at ${escaped(cell)} and ${found}\\.`)
    );
  }
);
Then(
  "{actor} hears it is {actor}'s turn",
  async (w, actor: string, player: string) => {
    const name = SIDE_NAMES[await sideOf(w, player)];
    await hears(w, actor, new RegExp(`${name} is firing\\.`));
  }
);
Then(
  "{actor} hears {actor}'s shot at {word} on her own board",
  async (w, actor: string, shooter: string, cell: string) => {
    const name = SIDE_NAMES[await sideOf(w, shooter)];
    await hears(w, actor, new RegExp(`${name} fired at ${escaped(cell)} and`));
  }
);
Then(
  "{actor} hears she sank {actor}'s {word}",
  async (w, actor: string, _owner: string, ship: string) => {
    await hears(
      w,
      actor,
      new RegExp(`You fired at \\S+ and sank the ${shipNamed(ship)}\\.`, 'i')
    );
  }
);
Then(
  "{actor}'s targeting board shows her miss, her hits and the sunk {word} as different marks, not by colour alone",
  async (w, actor: string, ship: string) => {
    const target = (await sees(w, actor)).target;
    const shot = shotCells(target).map((cell) => target[cell]!);
    const misses = shot.filter((cell) => cell.mark === 'miss');
    const sunk = shot.filter((cell) => cell.mark === 'sunk');
    expect(misses).not.toEqual([]);
    expect(sunk).not.toEqual([]);
    for (const cell of sunk) {
      expect(cell.ship).toBe(shipNamed(ship));
      // A sunk ship's cells are her hits, and say so.
      expect(cell.label).toMatch(/\bhit\b.*\bsunk\b/);
    }
    for (const cell of misses) expect(cell.label).toMatch(/\bmiss\b/);
    const glyphs = new Set([...misses, ...sunk].map((cell) => cell.glyph));
    expect(glyphs.has('')).toBe(false);
    expect(new Set(misses.map((cell) => cell.glyph)).size).toBe(1);
    expect(new Set(sunk.map((cell) => cell.glyph)).size).toBe(1);
    expect(glyphs.size).toBe(2);
  }
);
