import { expect } from 'bun:test';
import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameAwaySince } from '@libs/chess-custom-game-harness/custom-game-play-reads';
import { readCustomGameTime } from '@libs/game-session-harness/custom-game-clocks';
import { partition } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  customGame,
  customHost,
  customPeople,
  customPerson,
} from './custom-game-world';

const SECOND_MS = 1_000;
/** How long the other participant may take to be told someone went away. */
const AWAY_NOTICED_MS = 10_000;

/** The person on the other side of `actor` in the current game. */
async function otherParticipant(
  w: HarnessWorld,
  actor: string
): Promise<string> {
  const game = await customGame(w);
  const me = customPerson(w, actor);
  const other = game.white.person === me ? game.black : game.white;
  const name = [...customPeople(w)].find(([, id]) => id === other.person)?.[0];
  if (name === undefined) throw new Error(`${actor} has no other participant`);
  return name;
}

/**
 * `actor` loses the connection and stays away until `ms` have passed since
 * the other participant was shown them going.
 */
async function stayAway(
  w: HarnessWorld,
  actor: string,
  ms: number
): Promise<void> {
  const other = await otherParticipant(w, actor);
  await w.s.apply(partition, actor);
  if (actor === customHost(w)) {
    await w.s.advanceTime(ms);
    return;
  }
  const since = await w.s.until(
    (s) => readCustomGameAwaySince(s, other, customPerson(w, actor)),
    { pred: (value) => value !== null, maxMs: AWAY_NOTICED_MS }
  );
  if (since === null) throw new Error(`${other} was not told ${actor} left`);
  const elapsed = (await w.s.read(readCustomGameTime)) - since;
  await w.s.advanceTime(Math.max(0, ms - elapsed));
}

Given(
  '{actor} has been away from the Custom Game for {int} seconds',
  async (w, actor: string, seconds: number) =>
    stayAway(w, actor, seconds * SECOND_MS)
);

When('{actor} claims the win in the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'claimWin' })
);

Then(
  '{actor} wins the Custom Game because {actor} stayed away',
  async (w, winner: string, away: string) => {
    const game = await customGame(w);
    const side =
      game.white.person === customPerson(w, winner) ? 'white' : 'black';
    expect(game.white.person === customPerson(w, away)).toBe(side === 'black');
    expect(game.status).toBe('completed');
    expect(game.outcome).toBe(
      side === 'white'
        ? 'white wins because black stayed away'
        : 'black wins because white stayed away'
    );
  }
);
