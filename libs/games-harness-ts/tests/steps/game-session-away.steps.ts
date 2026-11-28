import { expect } from 'bun:test';
import { readGameSessionTime } from '@libs/game-session-harness-ts/game-session-clocks';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { partition } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  choose,
  current,
  identityOf,
  toldOf,
} from './game-session-set-up-world';
import { backToGameSessions, hostOf, sideOf } from './game-world';

const SECOND_MS = 1_000;
/** How long the other participant may take to be shown someone went away. */
const AWAY_NOTICED_MS = 10_000;
/** Everyone a game session scenario casts. */
const CAST = ['alice', 'bob', 'carol'] as const;

/** The person on the other side of `actor` in the game session. */
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
  const seen = await w.s.until((s) => gameSessionView(s, other), {
    pred: (view) => view.away[id] !== undefined,
    maxMs: AWAY_NOTICED_MS,
  });
  const since = seen.away[id];
  if (since === undefined)
    throw new Error(`${other} was not told ${actor} left`);
  const elapsed = (await w.s.read(readGameSessionTime)) - since;
  await w.s.advanceTime(Math.max(0, ms - elapsed));
}

Given(
  '{actor} has been away from the game session for {int} seconds',
  async (w, actor: string, seconds: number) =>
    stayAway(w, actor, seconds * SECOND_MS)
);
Given(
  '{actor} has been away from the game session for {int} minutes',
  async (w, actor: string, minutes: number) =>
    stayAway(w, actor, minutes * 60 * SECOND_MS)
);
Given('{actor} is away from the game session', async (w, actor: string) =>
  stayAway(w, actor, 0)
);

When('{actor} claims the win', async (w, actor: string) =>
  choose(w, actor, { operation: 'claimWin' })
);

Then(
  '{actor} wins the game session because {actor} stayed away',
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
// regression: game-session-reconnect-read-before-settlement
Then(
  '{actor} (still )sees the game session under way with the first side to move',
  async (w, actor: string) => {
    await backToGameSessions(w, actor);
    const seen = await w.s.until((s) => gameSessionView(s, actor), {
      pred: (view) =>
        view.current?.status === 'active' && view.current.turn === 'white',
    });
    expect(seen.current?.status).toBe('active');
    expect(seen.current?.turn).toBe('white');
    expect(seen.gates['watch']).toBe(true);
  }
);
Then('neither person has won the game session', async (w) => {
  expect((await current(w)).outcome).toBe('');
});
Then('the game session remains under way', async (w) => {
  expect((await current(w)).status).toBe('active');
});
