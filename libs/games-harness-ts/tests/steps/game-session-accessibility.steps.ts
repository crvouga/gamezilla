/**
 * A game session with the keyboard alone and by listening. What a person
 * hears names each side as the game itself names it (its presentation's
 * side labels), so the same claim holds for every game.
 */

import { expect } from 'bun:test';
import {
  assignGameSessionBotWithKeyboard,
  listenToGameSession,
  readGameSessionHeard,
  startGameSessionWithKeyboard,
} from '@libs/game-session-harness-ts/game-session-accessibility';
import { readGameSessionName } from '@libs/game-session-harness-ts/game-session-names';
import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionStartable } from '@libs/game-session-shared-ts/game-session-state';
import { Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { current, seatOf } from './game-session-set-up-world';
import { gameOf } from './game-world';

/** How the game names `side` to a person. */
function sideName(w: HarnessWorld, side: GameSessionSide): string {
  const presentation = gameOf(w).client.presentation;
  if (presentation === undefined)
    throw new Error(`${gameOf(w).label} has no board to name its sides`);
  return presentation.sideLabel(side);
}

/** What `actor` hears, with no accessibility failure on the screen. */
async function heard(w: HarnessWorld, actor: string): Promise<string> {
  const { description, problems } = await w.s.read(readGameSessionHeard, actor);
  expect(problems).toEqual([]);
  return description;
}

When(
  '{actor} assigns a bot to the {gameSide} with the keyboard alone',
  async (w, actor: string, side: GameSessionSide) =>
    w.s.apply(assignGameSessionBotWithKeyboard, actor, side)
);
When(
  '{actor} starts the game session with the keyboard alone',
  async (w, actor: string) => w.s.apply(startGameSessionWithKeyboard, actor)
);
When('{actor} listens to the game session', async (w, actor: string) =>
  w.s.apply(listenToGameSession, actor)
);

Then(
  '{actor} hears the first side is {actor} and the second side is a bot',
  async (w, actor: string, first: string) => {
    const description = await heard(w, actor);
    const game = await current(w);
    expect(game.white).toEqual(await seatOf(w, first));
    expect(game.black.kind).toBe('bot');
    expect(description).toContain(
      `${sideName(w, 'white')}: ${await w.s.read(readGameSessionName, actor, 'white')}.`
    );
    expect(description.toLowerCase()).toContain(
      `${sideName(w, 'black')}: bot`.toLowerCase()
    );
  }
);
Then(
  '{actor} hears whether the game session can start',
  async (w, actor: string) => {
    expect(await heard(w, actor)).toContain(
      gameSessionStartable(await current(w))
        ? 'Ready to start'
        : 'Waiting for participants and readiness'
    );
  }
);
Then("{actor} hears the game session's result", async (w, actor: string) => {
  const description = await heard(w, actor);
  const game = await current(w);
  expect(game.status).toBe('completed');
  expect(description).toContain(
    game.outcome === 'draw'
      ? 'Game drawn'
      : `${sideName(w, game.outcome.startsWith('white') ? 'white' : 'black')} wins`
  );
});
