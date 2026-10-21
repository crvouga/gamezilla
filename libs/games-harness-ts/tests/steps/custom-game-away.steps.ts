import { expect } from 'bun:test';
import { readCustomGameTime } from '@libs/game-session-harness-ts/custom-game-clocks';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { partition } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  choose,
  current,
  identityOf,
  toldOf,
} from './custom-game-set-up-world';
import { backToCustomGames, hostOf, sideOf } from './game-world';

const SECOND_MS = 1_000;
/** How long the other participant may take to be shown someone went away. */
const AWAY_NOTICED_MS = 10_000;
/** Everyone a custom game scenario casts. */
const CAST = ['alice', 'bob', 'carol'] as const;

/** The person on the other side of `actor` in the custom game. */
async function opponentOf(w: HarnessWorld, actor: string): Promise<string> {
  const game = await current(w);
  const other = (await sideOf(w, actor)) === 'white' ? game.black : game.white;
  for (const person of CAST)
    if (
      person !== actor &&
      (await w.s.read((s) => s.actors.has(person))) &&
      (await identityOf(w, person)) === other.person
    )
      return person;
  throw new Error(`${actor} has no other participant`);
}

/**
 * `actor` loses the connection and stays away until `ms` have passed since
 * the other participant was shown them going (the host's absence counts at
 * once).
 */
async function stayAway(
  w: HarnessWorld,
  actor: string,
  ms: number
): Promise<void> {
  const other = await opponentOf(w, actor);
  const id = await identityOf(w, actor);
  await w.s.apply(partition, actor);
  if (actor === hostOf(w)) {
    await w.s.advanceTime(ms);
    return;
  }
  const seen = await w.s.until((s) => customGameView(s, other), {
    pred: (view) => view.away[id] !== undefined,
    maxMs: AWAY_NOTICED_MS,
  });
  const since = seen.away[id];
  if (since === undefined)
    throw new Error(`${other} was not told ${actor} left`);
  const elapsed = (await w.s.read(readCustomGameTime)) - since;
  await w.s.advanceTime(Math.max(0, ms - elapsed));
}

Given(
  '{actor} has been away from the custom game for {int} seconds',
  async (w, actor: string, seconds: number) =>
    stayAway(w, actor, seconds * SECOND_MS)
);
Given(
  '{actor} has been away from the custom game for {int} minutes',
  async (w, actor: string, minutes: number) =>
    stayAway(w, actor, minutes * 60 * SECOND_MS)
);
Given('{actor} is away from the custom game', async (w, actor: string) =>
  stayAway(w, actor, 0)
);

When('{actor} claims the win', async (w, actor: string) =>
  choose(w, actor, { operation: 'claimWin' })
);

Then(
  '{actor} wins the custom game because {actor} stayed away',
  async (w, winner: string, away: string) => {
    const side = await sideOf(w, winner);
    const game = await current(w);
    expect(game[side === 'white' ? 'black' : 'white'].person).toBe(
      await identityOf(w, away)
    );
    expect(game.status).toBe('completed');
    expect(game.outcome).toBe(
      side === 'white'
        ? 'white wins because black stayed away'
        : 'black wins because white stayed away'
    );
  }
);
Then('{actor} is told {actor} may still return', async (w, actor: string) =>
  toldOf(w, actor, 'may still return')
);
// regression: custom-game-reconnect-read-before-settlement
Then(
  '{actor} (still )sees the custom game under way with the first side to move',
  async (w, actor: string) => {
    await backToCustomGames(w, actor);
    const seen = await w.s.until((s) => customGameView(s, actor), {
      pred: (view) =>
        view.current?.status === 'active' && view.current.turn === 'white',
    });
    expect(seen.current?.status).toBe('active');
    expect(seen.current?.turn).toBe('white');
    expect(seen.gates['watch']).toBe(true);
  }
);
Then('neither person has won the custom game', async (w) => {
  expect((await current(w)).outcome).toBe('');
});
Then('the custom game remains under way', async (w) => {
  expect((await current(w)).status).toBe('active');
});
