import { expect } from 'bun:test';
import {
  givenOpenedTurnNotice,
  shownMultiplayerNotices,
} from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { closeApp } from './multiplayer-app.steps';
import { disconnectMultiplayer } from './multiplayer-connection';
import {
  noticeGame,
  noticesAfter,
  noticesWithin,
  openNotice,
} from './multiplayer-notice-world';
import { givenGame, move } from './multiplayer-world';

Then(
  "{actor}'s inbox shows a turn notice for their daily game with {actor} within {int} seconds",
  (w, actor: Actor, opponent: Actor, seconds: number) =>
    noticesWithin(w, actor, { kind: 'turn', opponent, count: 1, seconds })
);
Then(
  "{actor}'s inbox shows one unread turn notice for their daily game with {actor} within {int} seconds",
  (w, actor: Actor, opponent: Actor, seconds: number) =>
    noticesWithin(w, actor, {
      kind: 'turn',
      opponent,
      unread: true,
      count: 1,
      seconds,
    })
);
Then(
  "{actor}'s inbox stops showing the turn notice for their daily game with {actor} within {int} seconds",
  (w, actor: Actor, _opponent: Actor, seconds: number) =>
    noticesWithin(w, actor, { kind: 'turn', count: 0, seconds })
);
Then(
  "{actor}'s inbox still shows no turn notice after {int} seconds",
  (w, actor: Actor, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', count: 0, seconds })
);
Then(
  "{actor}'s inbox still shows one turn notice for their daily game with {actor} after {int} seconds",
  (w, actor: Actor, opponent: Actor, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', opponent, count: 1, seconds })
);
Then(
  "{actor}'s inbox still shows one unread turn notice for their daily game with {actor} after {int} seconds",
  (w, actor: Actor, opponent: Actor, seconds: number) =>
    noticesAfter(w, actor, {
      kind: 'turn',
      opponent,
      unread: true,
      count: 1,
      seconds,
    })
);
Then(
  "{actor}'s turn notice names {username} as their multiplayer opponent",
  async (w, actor: Actor, username: string) => {
    const named = (
      shown: Awaited<ReturnType<typeof shownMultiplayerNotices>>
    ) =>
      shown.some(
        (notice) =>
          notice.kind === 'turn' && notice.text.includes(`@${username}`)
      );
    await w.s.until((s) => shownMultiplayerNotices(s, actor), { pred: named });
    expect(named(await w.s.read(shownMultiplayerNotices, actor))).toBe(true);
  }
);
Then("{actor}'s turn notice is no longer unread", async (w, actor: Actor) => {
  const opened = (shown: Awaited<ReturnType<typeof shownMultiplayerNotices>>) =>
    shown.some((notice) => notice.kind === 'turn' && !notice.unread);
  await w.s.until((s) => shownMultiplayerNotices(s, actor), { pred: opened });
  expect(opened(await w.s.read(shownMultiplayerNotices, actor))).toBe(true);
});

When('{actor} opens their turn notice', (w, actor: Actor) =>
  openNotice(w, actor, 'turn')
);
Given(
  '{actor} opened their turn notice before playing e5',
  async (w, actor: Actor) => {
    await w.s.apply(givenOpenedTurnNotice, actor, noticeGame(w).id);
  }
);

/** White's first move is accepted while Black is away from the game. */
async function firstMoveWhileAway(
  w: HarnessWorld,
  people: { readonly away: string; readonly mover: string },
  days: number,
  leave: (w: HarnessWorld, actor: string) => Promise<void>
) {
  await givenGame(w, people.mover, people.away, dailyTimeControlId(days));
  await leave(w, people.away);
  expect((await move(w, people.mover, 'e2e4')).result.ok).toBe(true);
  await w.s.until(
    async (s) => (await multiplayerView(s, people.mover)).game?.revision === 1
  );
}

Given(
  "{actor}'s phone was offline when {actor}'s first move in their daily game at {int} day(s) per move was accepted",
  (w, away: Actor, mover: Actor, days: number) =>
    firstMoveWhileAway(w, { away, mover }, days, disconnectMultiplayer)
);
Given(
  "{actor}'s app was closed when {actor}'s first move in their daily game at {int} day(s) per move was accepted",
  (w, away: Actor, mover: Actor, days: number) =>
    firstMoveWhileAway(w, { away, mover }, days, closeApp)
);
