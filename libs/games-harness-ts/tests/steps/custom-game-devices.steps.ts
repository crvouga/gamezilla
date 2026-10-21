/**
 * One custom game on two devices of the same account: the other device is
 * the same person signed in again, joined to the same space.
 */

import { expect } from 'bun:test';
import { readCustomGameIdentity } from '@libs/game-session-harness-ts/custom-game-identity';
import {
  firstLegalMove,
  makeCustomGameMove,
} from '@libs/game-session-harness-ts/custom-game-moves';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { readCustomGameMoveList } from '@libs/game-session-harness-ts/custom-game-reads';
import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import {
  recordedLine,
  recordedMove,
} from '@libs/game-session-harness-ts/played-rules';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { joinViaLink } from '@libs/spaces-harness-ts/space-actions';
import { current, identityOf, race } from './custom-game-set-up-world';
import { gameOf, sideOf, spaceLinkOf } from './game-world';

const SECOND_MS = 1000;
/** How long the other device may take to show what the first one shows. */
const CAUGHT_UP_MS = 5 * SECOND_MS;

/** `actor` signs in on their other device and opens the same custom game. */
async function secondDevice(w: HarnessWorld, actor: Actor): Promise<string> {
  const device = otherDevice(actor);
  const game = await current(w);
  await w.s.apply(signInWithGoogleAsAccount, device, actor);
  await w.s.apply(returnToTabs, device);
  await w.s.apply(joinViaLink, device, await spaceLinkOf(w));
  await w.s.apply(openCustomGames, device, gameOf(w).shared.id);
  await w.s.until((s) => customGameView(s, device), {
    pred: (seen) => seen.current?.id === game.id,
    maxMs: CAUGHT_UP_MS,
  });
  expect(await w.s.read(readCustomGameIdentity, device)).toBe(
    await identityOf(w, actor)
  );
  return device;
}

/** What each of `actor`'s devices shows once `pred` holds on both. */
async function bothDevices(
  w: HarnessWorld,
  actor: Actor,
  pred: (seen: Awaited<ReturnType<typeof customGameView>>) => boolean
) {
  const shown = [];
  for (const device of [actor, otherDevice(actor)])
    shown.push(
      await w.s.until((s) => customGameView(s, device), {
        pred,
        maxMs: CAUGHT_UP_MS,
      })
    );
  return shown;
}

Given(
  '{actor} has the custom game open on another device',
  async (w, actor: Actor) => {
    await secondDevice(w, actor);
  }
);
Given(
  "{actor}'s other device is offline with the custom game open",
  async (w, actor: Actor) => {
    const device = await secondDevice(w, actor);
    await w.s.apply(partition, device);
    await w.s.advanceTime(SECOND_MS);
    expect((await w.s.read(customGameView, device)).connected).toBe(false);
  }
);

When(
  '{actor} returns to the custom game on another device',
  async (w, actor: Actor) => {
    await secondDevice(w, actor);
  }
);
When(
  '{actor} makes her move on both devices at the same time',
  async (w, actor: Actor) => {
    const game = await current(w);
    const choice = {
      operation: 'move',
      uci: firstLegalMove(gameOf(w), game.fen),
      ply: game.moves.length,
    } as const;
    await race(w, [
      { actor, choice },
      { actor: otherDevice(actor), choice },
    ]);
  }
);
When("{actor}'s other device comes back online", async (w, actor: Actor) => {
  const device = otherDevice(actor);
  await w.s.apply(restoreActorConnection, device);
  await w.s.until((s) => customGameView(s, device), {
    pred: (seen) => seen.connected,
    maxMs: CAUGHT_UP_MS,
  });
});
When(
  '{actor} makes a move on her offline other device',
  async (w, actor: Actor) => {
    await w.s.apply(
      makeCustomGameMove,
      otherDevice(actor),
      gameOf(w).shared.id
    );
  }
);

Then(
  "it is {actor}'s turn on both of {actor}'s devices",
  async (w, mover: Actor, actor: Actor) => {
    const turn = await sideOf(w, mover);
    const own = await sideOf(w, actor);
    for (const seen of await bothDevices(
      w,
      actor,
      (view) => view.current?.turn === turn
    )) {
      expect(seen.current?.turn).toBe(turn);
      expect(seen.mySide).toBe(own);
    }
  }
);
Then(
  "both of {actor}'s devices show her move in the move list",
  async (w, actor: Actor) => {
    const first = recordedLine(
      gameOf(w),
      gameOf(w).fixtures.firstSideVictory.slice(0, 1)
    );
    for (const device of [actor, otherDevice(actor)]) {
      const seen = await w.s.read(customGameView, device);
      expect(seen.current?.moves.map((move) => move.uci)).toEqual(first);
      expect(await w.s.read(readCustomGameMoveList, device)).toEqual(
        seen.current?.moves.map((move) => move.san) ?? []
      );
    }
  }
);
Then('the move list shows her move once', async (w) => {
  const game = await current(w);
  const initial = gameOf(w).shared.turnGame.rules.initial();
  expect(game.moves.map((move) => move.uci)).toEqual([
    recordedMove(gameOf(w), initial, firstLegalMove(gameOf(w), initial)),
  ]);
});
Then(
  "both of {actor}'s devices show her victory by resignation",
  async (w, actor: Actor) => {
    const outcome = `${await sideOf(w, actor)} wins by resignation`;
    for (const seen of await bothDevices(
      w,
      actor,
      (view) => view.current?.status === 'completed'
    ))
      expect(seen.current?.outcome).toBe(outcome);
  }
);
Then(
  '{actor} is told the game needs a connection on her other device',
  async (w, actor: Actor) => {
    expect((await w.s.read(customGameView, otherDevice(actor))).error).toBe(
      'connection needed'
    );
  }
);
