/**
 * Shared victories in a four-player custom game: the game's known lines to
 * a victory the first and third sides share and to the third side's alone
 * (`sharedVictories`), each ending on the fourth side's move.
 */

import { expect } from 'bun:test';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { Given, Then } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { current } from './custom-game-set-up-world';
import { before, turnGameOf } from './game-world';
import { followKnownLine, playToLastMove } from './known-line';
import { FOUR_PEOPLE, sideShown } from './secret-choices-world';

const BOTH = ['alice', 'bob', 'carol', 'dave'] as const;

function sharedVictoriesOf(game: TurnHarnessGame) {
  const lines = game.fixtures.sharedVictories;
  if (lines === undefined)
    throw new Error(`${game.label} names no shared victory`);
  return lines;
}

/** The winners a finished custom game's result names, as `viewer` sees it. */
async function winnersSeenBy(w: HarnessWorld, viewer: string): Promise<string> {
  const seen = await w.s.until((s) => customGameView(s, viewer), {
    pred: (shown) => shown.current?.status === 'completed',
  });
  expect(seen.current?.status).toBe('completed');
  return seen.current?.outcome ?? '';
}

Given(
  'the custom game is one move from a victory Alice and Carol share',
  async (w) => playToLastMove(w, sharedVictoriesOf(turnGameOf(w)).shared)
);
Given("the custom game is one move from Carol's victory alone", async (w) =>
  playToLastMove(w, sharedVictoriesOf(turnGameOf(w)).alone)
);
Given(
  'Alice and Carol have shared the victory in a four-player custom game with Bob and Dave',
  async (w) => {
    const line = sharedVictoriesOf(turnGameOf(w)).shared;
    await followKnownLine(w, FOUR_PEOPLE, line, line.length);
    expect((await current(w)).status).toBe('completed');
  }
);

Then(
  '{actor}, {actor}, {actor} and {actor} see {actor} and {actor} share the victory',
  async (w, ...people: [string, string, string, string, string, string]) => {
    const [first = '', second = ''] = people.slice(-2);
    const named = `${await sideShown(w, first)} and ${await sideShown(w, second)} win by `;
    for (const viewer of people.slice(0, -2))
      expect(await winnersSeenBy(w, viewer)).toStartWith(named);
  }
);
Then(
  '{actor}, {actor}, {actor} and {actor} see {actor} as the only winner',
  async (w, ...people: [string, string, string, string, string]) => {
    const [winner = ''] = people.slice(-1);
    const named = `${await sideShown(w, winner)} wins by `;
    for (const viewer of people.slice(0, -1))
      expect(await winnersSeenBy(w, viewer)).toStartWith(named);
  }
);
Then(
  '{actor} and {actor} are not shown as winners',
  async (w, first: string, second: string) => {
    for (const viewer of BOTH) {
      const [winners = ''] = (await winnersSeenBy(w, viewer)).split(' win');
      const named = winners.split(/, | and /);
      expect(named).not.toContain(await sideShown(w, first));
      expect(named).not.toContain(await sideShown(w, second));
    }
  }
);
Then(
  '{actor} and {actor} still share the victory',
  async (w, first: string, second: string) => {
    const outcome = (await current(w)).outcome;
    expect(outcome).toBe(before(w).current?.outcome ?? '');
    expect(outcome).toStartWith(
      `${await sideShown(w, first)} and ${await sideShown(w, second)} win by `
    );
  }
);
