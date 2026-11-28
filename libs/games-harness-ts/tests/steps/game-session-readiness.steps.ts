import { expect } from 'bun:test';
import { gameSessionStartOffered } from '@libs/game-session-harness-ts/game-session-reads';
import { attemptGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  choose,
  chosen,
  clockChoice,
  current,
  race,
  toldOf,
} from './game-session-set-up-world';
import { before, hostOf, rememberGameSession, view } from './game-world';

async function startOffered(w: HarnessWorld): Promise<boolean> {
  return w.s.read(gameSessionStartOffered, hostOf(w));
}

Given("the game session's set-up changed before {actor}'s start", async (w) => {
  await rememberGameSession(w);
  await chosen(w, hostOf(w), { operation: 'clock', ...clockChoice('5+2') });
});

When('{actor} becomes ready for the game session', async (w, actor: string) =>
  choose(w, actor, { operation: 'ready' })
);
When(
  '{actor} withdraws readiness for the game session',
  async (w, actor: string) => choose(w, actor, { operation: 'unready' })
);
When(
  '{actor} chooses {word} for the game session',
  async (w, actor: string, clock: string) =>
    choose(w, actor, { operation: 'clock', ...clockChoice(clock) })
);
When(
  '{actor} starts the game session twice at the same time',
  async (w, actor: string) =>
    race(w, [
      { actor, choice: { operation: 'start' } },
      { actor, choice: { operation: 'start' } },
    ])
);
When(
  '{actor} starts the game session with the earlier set-up',
  async (w, actor: string) => {
    const earlier = before(w).current;
    if (earlier === null) throw new Error('No earlier set-up to start');
    await w.s.apply(attemptGameSessionChoice, actor, {
      operation: 'start',
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);

Then('the game session can start', async (w) => {
  expect(await startOffered(w)).toBe(true);
});
Then('the game session cannot start', async (w) => {
  expect(await startOffered(w)).toBe(false);
});
Then('the game session is played at {word}', async (w, clock: string) => {
  const game = await current(w);
  expect({ minutes: game.minutes, increment: game.increment }).toEqual(
    clockChoice(clock)
  );
});
Then('the game session is under way with the first side to move', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('active');
  expect(game.turn).toBe('white');
});
Then('the game session remains under way with no new game', async (w) => {
  const earlier = before(w);
  const now = await current(w);
  expect(now.status).toBe('active');
  expect(now.id).toBe(earlier.current?.id ?? '');
  expect(now.moves).toEqual([]);
  // A start already acknowledged keeps the moment the game session began.
  if (earlier.current?.status === 'active')
    expect(now.startedAt).toBe(earlier.current.startedAt);
  expect((await view(w, hostOf(w))).history).toEqual(earlier.history);
});

Then('{actor} is told every person must be ready', async (w, actor: string) =>
  toldOf(w, actor, 'every person must be ready')
);
Then(
  '{actor} is told only the creator starts the game session',
  async (w, actor: string) =>
    toldOf(
      w,
      actor,
      'only the creator starts the Game Session',
      'only the creator'
    )
);
Then(
  "{actor} is told the game session's set-up has changed",
  async (w, actor: string) => toldOf(w, actor, 'choices changed')
);
