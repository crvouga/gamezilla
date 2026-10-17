import { expect } from 'bun:test';
import { customGameStartOffered } from '@libs/game-session-harness/custom-game-reads';
import { attemptCustomGameChoice } from '@libs/game-session-harness/custom-game-ui';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  choose,
  chosen,
  current,
  race,
  toldOf,
} from './custom-game-set-up-world';
import { before, hostOf, rememberCustomGame, view } from './game-world';

/** `5+2` as the minutes each side starts with and the seconds a move adds. */
function clockChoice(text: string): { minutes: number; increment: number } {
  const [minutes, increment] = text.split('+').map(Number);
  if (minutes === undefined || increment === undefined)
    throw new Error(`a clock choice reads like 5+2, not "${text}"`);
  return { minutes, increment };
}

async function startOffered(w: HarnessWorld): Promise<boolean> {
  return w.s.read(customGameStartOffered, hostOf(w));
}

Given("the custom game's set-up changed before {actor}'s start", async (w) => {
  await rememberCustomGame(w);
  await chosen(w, hostOf(w), { operation: 'clock', ...clockChoice('5+2') });
});

When('{actor} becomes ready for the custom game', async (w, actor: string) =>
  choose(w, actor, { operation: 'ready' })
);
When(
  '{actor} withdraws readiness for the custom game',
  async (w, actor: string) => choose(w, actor, { operation: 'unready' })
);
When(
  '{actor} chooses {word} for the custom game',
  async (w, actor: string, clock: string) =>
    choose(w, actor, { operation: 'clock', ...clockChoice(clock) })
);
When(
  '{actor} starts the custom game twice at the same time',
  async (w, actor: string) =>
    race(w, [
      { actor, choice: { operation: 'start' } },
      { actor, choice: { operation: 'start' } },
    ])
);
When(
  '{actor} starts the custom game with the earlier set-up',
  async (w, actor: string) => {
    const earlier = before(w).current;
    if (earlier === null) throw new Error('No earlier set-up to start');
    await w.s.apply(attemptCustomGameChoice, actor, {
      operation: 'start',
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);

Then('the custom game can start', async (w) => {
  expect(await startOffered(w)).toBe(true);
});
Then('the custom game cannot start', async (w) => {
  expect(await startOffered(w)).toBe(false);
});
Then('the custom game is played at {word}', async (w, clock: string) => {
  const game = await current(w);
  expect({ minutes: game.minutes, increment: game.increment }).toEqual(
    clockChoice(clock)
  );
});
Then('the custom game is under way with the first side to move', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('active');
  expect(game.turn).toBe('white');
});
Then('the custom game remains under way with no new game', async (w) => {
  const earlier = before(w);
  const now = await current(w);
  expect(now.status).toBe('active');
  expect(now.id).toBe(earlier.current?.id ?? '');
  expect(now.moves).toEqual([]);
  // A start already acknowledged keeps the moment the custom game began.
  if (earlier.current?.status === 'active')
    expect(now.startedAt).toBe(earlier.current.startedAt);
  expect((await view(w, hostOf(w))).history).toEqual(earlier.history);
});

Then('{actor} is told every person must be ready', async (w, actor: string) =>
  toldOf(w, actor, 'every person must be ready')
);
Then(
  '{actor} is told only the creator starts the custom game',
  async (w, actor: string) =>
    toldOf(
      w,
      actor,
      'only the creator starts the Custom Game',
      'only the creator'
    )
);
Then(
  "{actor} is told the custom game's set-up has changed",
  async (w, actor: string) => toldOf(w, actor, 'choices changed')
);
