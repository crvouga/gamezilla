/**
 * `specs/games/unfinished-game-return.feature`: a person with an unfinished
 * game is offered to return to it wherever they are, on every device, and
 * in place of seeking an opponent.
 */

import { expect } from 'bun:test';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import {
  type ReturnOffered,
  returnToGame,
  returnToGameOffered,
  seekOpponentOffered,
} from '@libs/game-matchmaking-harness-ts/return-to-game';
import { pickGame } from '@libs/game-session-harness-ts/game-navigation';
import { attemptGoBackToGameChoice } from '@libs/game-session-harness-ts/space-game-choice';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  createSpace,
  returnToLobby,
} from '@libs/spaces-harness-ts/space-actions';
import { anotherGame, gameOf } from './game-world';
import { actingDevice } from './matched-game';

/** How long an offer takes to reach a device: the record syncs to it. */
const OFFER_SETTLES_MS = 15_000;

async function offered(
  w: HarnessWorld,
  device: string,
  game: Exclude<ReturnOffered, null>
): Promise<void> {
  await w.s.apply(focusActor, device);
  expect(
    await w.s.until((s) => returnToGameOffered(s, device), {
      maxMs: OFFER_SETTLES_MS,
      pred: (shown) => shown === game,
    })
  ).toBe(game);
}

async function notOffered(
  w: HarnessWorld,
  device: string,
  game: Exclude<ReturnOffered, null>
): Promise<void> {
  await w.s.apply(focusActor, device);
  expect(
    await w.s.until((s) => returnToGameOffered(s, device), {
      maxMs: OFFER_SETTLES_MS,
      pred: (shown) => shown !== game,
    })
  ).not.toBe(game);
}

async function seekShown(w: HarnessWorld, device: string): Promise<boolean> {
  await w.s.apply(focusActor, device);
  return w.s.read(seekOpponentOffered, device);
}

Given(
  '{actor} is hosting a space on her/his other device',
  async (w, actor: string) => {
    if ((await w.s.read(signedInAccountOf, actor)) === null)
      await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(signInWithGoogleAsAccount, otherDevice(actor), actor);
    await w.s.apply(returnToTabs, otherDevice(actor));
    await w.s.apply(createSpace, otherDevice(actor));
  }
);
Given(
  '{actor} has picked another game for the space',
  async (w, actor: string) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(attemptGoBackToGameChoice, actor, gameOf(w).shared.id);
    await w.s.apply(pickGame, actor, anotherGame(w, 'matchmaking').shared.id);
  }
);

When(
  '{actor} goes back to the lobby on her/his other device',
  (w, actor: string) => w.s.apply(returnToLobby, otherDevice(actor))
);
When(
  '{actor} opens finding an opponent for another game',
  async (w, actor: string) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(attemptGoBackToGameChoice, actor, gameOf(w).shared.id);
    await w.s.apply(
      openFindingAnOpponent,
      actor,
      anotherGame(w, 'matchmaking').shared.id
    );
  }
);
When(
  '{actor} opens finding an opponent on her/his other device',
  async (w, actor: string) => {
    await w.s.apply(focusActor, otherDevice(actor));
    await w.s.apply(
      openFindingAnOpponent,
      otherDevice(actor),
      gameOf(w).shared.id
    );
  }
);
When('{actor} returns to her/his matched game', async (w, actor: string) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(returnToGame, actor);
});

Then('{actor} is offered to return to the custom game', (w, actor: string) =>
  offered(w, actor, 'custom')
);
Then(
  '{actor} is offered to return to the custom game on her/his other device',
  (w, actor: string) => offered(w, otherDevice(actor), 'custom')
);
Then(
  '{actor} is not offered to return to the custom game',
  (w, actor: string) => notOffered(w, actingDevice(w, actor), 'custom')
);
Then(
  '{actor} is offered to return to her/his matched game',
  (w, actor: string) => offered(w, actingDevice(w, actor), 'matched')
);
Then(
  '{actor} is offered to return to her/his matched game on her/his other device',
  (w, actor: string) => offered(w, otherDevice(actor), 'matched')
);
Then(
  '{actor} is not offered to return to her/his matched game',
  (w, actor: string) => notOffered(w, actingDevice(w, actor), 'matched')
);
Then('{actor} is offered to seek an opponent', async (w, actor: string) => {
  expect(await seekShown(w, actor)).toBe(true);
});
Then('{actor} is not offered to seek an opponent', async (w, actor: string) => {
  expect(await seekShown(w, actor)).toBe(false);
});
Then(
  '{actor} is not offered to seek an opponent on her/his other device',
  async (w, actor: string) => {
    expect(await seekShown(w, otherDevice(actor))).toBe(false);
  }
);
