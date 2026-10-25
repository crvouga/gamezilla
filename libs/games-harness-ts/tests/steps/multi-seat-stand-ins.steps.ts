/**
 * Stand-ins in a custom game of more than two sides: after 60 seconds away
 * a disclosed stand-in plays the person's side, refusing their own moves and
 * secret choices, until they take their side back with a connection.
 */

import { expect } from 'bun:test';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { CUSTOM_GAME_STAND_IN_MS } from '@libs/game-session-shared-ts/custom-game-stand-in';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { stayAway } from './custom-game-away.steps';
import {
  choose,
  current,
  identityOf,
  toldOf,
} from './custom-game-set-up-world';
import { before, rememberCustomGame } from './game-world';
import {
  backOnline,
  rememberScreen,
  SHOWN_WITHIN_MS,
  sideShown,
} from './secret-choices-world';

const SECOND_MS = 1_000;

/**
 * `actor` stays away until a stand-in plays their side, and the stand-in
 * has decided whatever their side had to decide right then.
 */
async function standInPlays(w: HarnessWorld, actor: string): Promise<void> {
  const side = await sideShown(w, actor);
  await stayAway(w, actor, CUSTOM_GAME_STAND_IN_MS);
  const game = await current(w);
  const settled = await w.s.until((s) => customGameView(s, 'alice'), {
    pred: (shown) =>
      shown.current?.standIns.includes(side) === true &&
      !shown.current.awaiting.includes(side) &&
      !(shown.current.awaiting.length === 0 && shown.current.turn === side),
    maxMs: SHOWN_WITHIN_MS,
  });
  expect(settled.current?.standIns).toContain(side);
  expect(game.status).toBe('active');
  await rememberCustomGame(w);
}

Given("a stand-in is playing {actor}'s side", async (w, actor: string) =>
  standInPlays(w, actor)
);
Given(
  "a stand-in is playing {actor}'s side and has made its secret choice",
  async (w, actor: string) => {
    await standInPlays(w, actor);
    expect((await current(w)).committed).toContain(await sideShown(w, actor));
  }
);
Given('{actor} is back online', async (w, actor: string) => {
  await backOnline(w, actor);
  await rememberScreen(w, actor);
});
Given(
  '{actor} is back online and has taken back his/her side',
  async (w, actor: string) => {
    await backOnline(w, actor);
    await choose(w, actor, { operation: 'reclaim' });
    expect((await current(w)).standIns).not.toContain(
      await sideShown(w, actor)
    );
    await rememberCustomGame(w);
  }
);

When('a second passes', async (w) => {
  await w.s.apply(passMultiplayerTime, SECOND_MS);
});
When('{actor} takes back his/her side', async (w, actor: string) =>
  choose(w, actor, { operation: 'reclaim' })
);
// The take-back names no side: it is always the person's own.
When("{actor} takes back {actor}'s side", async (w, actor: string) =>
  choose(w, actor, { operation: 'reclaim' })
);

Then(
  "{actor}, {actor} and {actor} see a stand-in playing {actor}'s side",
  async (w, ...[a, b, c, person]: [string, string, string, string]) => {
    const side = await sideShown(w, person);
    for (const viewer of [a, b, c]) {
      const seen = await w.s.until((s) => customGameView(s, viewer), {
        pred: (shown) => shown.current?.standIns.includes(side) === true,
        maxMs: SHOWN_WITHIN_MS,
      });
      expect(seen.current?.standIns).toContain(side);
    }
  }
);
Then(
  "{actor}'s stand-in makes a move for {actor}'s side",
  async (w, _standIn: string, person: string) => {
    const side = await sideShown(w, person);
    const earlier = before(w).current?.moves.length ?? 0;
    const seen = await w.s.until((s) => customGameView(s, 'alice'), {
      pred: (shown) => (shown.current?.moves.length ?? 0) > earlier,
      maxMs: SHOWN_WITHIN_MS,
    });
    expect(before(w).current?.turn).toBe(side);
    expect(seen.current?.moves).toHaveLength(earlier + 1);
    expect(seen.current?.turn).not.toBe(side);
    expect(seen.current?.standIns).toContain(side);
  }
);
Then("{actor}'s side still has no stand-in", async (w, actor: string) => {
  expect((await current(w)).standIns).not.toContain(await sideShown(w, actor));
});
Then("no stand-in plays {actor}'s side", async (w, actor: string) => {
  expect((await current(w)).standIns).not.toContain(await sideShown(w, actor));
});
Then("a stand-in still plays {actor}'s side", async (w, actor: string) => {
  expect((await current(w)).standIns).toContain(await sideShown(w, actor));
});
Then('{actor} still plays his/her own side', async (w, actor: string) => {
  const side = await sideShown(w, actor);
  const game = await current(w);
  expect(game[side].person).toBe(await identityOf(w, actor));
  expect(game.standIns).not.toContain(side);
});
Then(
  '{actor} is told a stand-in plays his/her side until he/she takes back his/her side',
  async (w, actor: string) => toldOf(w, actor, 'a stand-in plays your side')
);
Then(
  '{actor} is told no stand-in plays his/her side',
  async (w, actor: string) => toldOf(w, actor, 'no stand-in plays your side')
);
// Taking back names no side: someone else's take-back finds no stand-in on
// their own side, and Bob's side stays the stand-in's.
Then(
  '{actor} is told only {actor} may take back his/her side',
  async (w, actor: string) => toldOf(w, actor, 'no stand-in plays your side')
);
