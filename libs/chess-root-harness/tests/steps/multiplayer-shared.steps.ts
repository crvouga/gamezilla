import { expect } from 'bun:test';

import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  shownMultiplayerClock,
  shownMultiplayerText,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { Then } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';

const SECOND_MS = 1_000;

async function moveList(
  w: HarnessWorld,
  actor: string,
  moves: string
): Promise<void> {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (
        await shownMultiplayerText(s, actor, 'multiplayer-move-list')
      )?.trim() === moves,
    { maxMs: 5 * SECOND_MS }
  );
  expect(
    (
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-move-list')
    )?.trim()
  ).toBe(moves);
}

async function clocks(
  w: HarnessWorld,
  actor: string,
  white: number,
  black: number
): Promise<void> {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (await shownMultiplayerClock(s, actor, 'white')) === white &&
      (await shownMultiplayerClock(s, actor, 'black')) === black,
    { maxMs: 5 * SECOND_MS }
  );
}

Then(
  'Bob, Carol and Dave see the multiplayer move list {string}',
  async (w, moves: string) => {
    for (const actor of ['bob', 'carol', 'dave'])
      await moveList(w, actor, moves);
  }
);

Then(
  "Bob, Carol and Dave see {int} seconds on White's multiplayer clock and {int} seconds on Black's",
  async (w, white: number, black: number) => {
    for (const actor of ['bob', 'carol', 'dave'])
      await clocks(w, actor, white, black);
  }
);
