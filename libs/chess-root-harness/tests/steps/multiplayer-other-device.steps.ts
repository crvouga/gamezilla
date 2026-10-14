/**
 * One multiplayer game, played or copied from the person's other device.
 * The phone is the person; the other device is the same account.
 */

import { expect } from 'bun:test';
import { copyGameRecord } from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import { givenGame, playOnOwnBoard, sameBoards } from './multiplayer-world';

When(
  '{actor} copies the game record on another device',
  async (w, actor: Actor) => {
    const device = otherDevice(actor);
    await w.s.until(
      async (s) => (await multiplayerView(s, device)).game?.outcome ?? null,
      {
        pred: (outcome) => outcome !== null && outcome !== 'ongoing',
        maxMs: 20_000,
      }
    );
    await w.s.apply(copyGameRecord, device);
    w.memo.set(`multiplayer:viewer:${actor}`, device);
  }
);

async function playOpeningOn(
  w: Parameters<typeof playOnOwnBoard>[0],
  device: string
): Promise<void> {
  await w.s.until(
    async (s) => (await multiplayerView(s, device)).game !== null,
    {
      maxMs: 20_000,
    }
  );
  await playOnOwnBoard(w, device, 'e2e4');
}

When(
  '{actor} plays e2 to e4 as a multiplayer move on her other device',
  async (w, actor: Actor) => {
    await playOpeningOn(w, otherDevice(actor));
  }
);

When(
  '{actor} plays e2 to e4 as a multiplayer move on her phone',
  async (w, actor: Actor) => {
    await playOnOwnBoard(w, actor, 'e2e4');
  }
);

Given(
  "{actor}'s multiplayer move e2 to e4 was accepted from her other device",
  async (w, actor: Actor) => {
    await givenGame(w, actor);
    const device = otherDevice(actor);
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
    await playOpeningOn(w, device);
    expect((await sameBoards(w)).revision).toBe(1);
  }
);
