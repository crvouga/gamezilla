import { expect } from 'bun:test';

import { leaveChessMenuToGameMenu } from '@libs/chess-puzzle-harness/chess-actions';
import { readPuzzleView } from '@libs/chess-puzzle-harness/puzzle-control-reads';
import { chessGameMenuVisible } from '@libs/chess-root-harness/chess-ui-reads';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  createSpace,
  joinViaLink,
  returnToOwnSpace,
  selectChessGame,
} from '@libs/spaces-harness/space-actions';
import {
  chessChoiceOffered,
  gameChoiceRefusedShown,
  spaceBackOffered,
} from '@libs/spaces-harness/space-device-reads';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';

const SECOND_MS = 1_000;

async function hostJoined(
  w: HarnessWorld,
  host: Actor,
  guest: Actor
): Promise<void> {
  await w.s.apply(createSpace, host);
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} has no space`);
  await w.s.apply(joinViaLink, guest, link);
}

async function otherPicksChess(w: HarnessWorld, host: Actor): Promise<void> {
  const device = otherDevice(host);
  await w.s.apply(signInWithGoogleAsAccount, device, host);
  await w.s.apply(returnToTabs, device);
  await w.s.apply(returnToOwnSpace, device);
  await w.s.apply(selectChessGame, device);
}

Given(
  "{actor}'s other device has picked chess for the space {actor} joined",
  async (w, host: Actor, guest: Actor) => {
    await hostJoined(w, host, guest);
    await otherPicksChess(w, host);
  }
);

Given('{actor} has picked chess for the space', async (w, host: Actor) => {
  await w.s.apply(selectChessGame, host);
});

Given(
  '{actor} has picked chess for the space from her other device',
  async (w, host: Actor) => {
    await otherPicksChess(w, host);
  }
);

Given(
  '{actor} has picked chess for the space {actor} joined and her phone is offline',
  async (w, host: Actor, guest: Actor) => {
    await hostJoined(w, host, guest);
    await w.s.apply(selectChessGame, host);
    // The host's own menu appears before the choice is committed. Wait until
    // the guest has it, then take the phone offline.
    await w.s.until((s) => chessGameMenuVisible(s, guest), {
      maxMs: 15 * SECOND_MS,
    });
    await cutConnection(w, host);
  }
);

When(
  '{actor} picks chess for the space on her other device',
  async (w, host: Actor) => {
    await w.s.apply(selectChessGame, otherDevice(host));
  }
);

When(
  '{actor} picks chess for the space on her phone',
  async (w, host: Actor) => {
    await w.s.apply(selectChessGame, host);
  }
);

When(
  '{actor} goes back from the chess choices to the game choice on her phone',
  async (w, host: Actor) => {
    await w.s.apply(leaveChessMenuToGameMenu, host);
  }
);

Then(
  '{actor} is told only the host chooses the game',
  async (w, actor: Actor) => {
    await w.s.until((s) => gameChoiceRefusedShown(s, actor), {
      maxMs: 15 * SECOND_MS,
    });
  }
);

Then(
  '{actor} is not offered to pick chess for the space',
  async (w, actor: Actor) => {
    expect(await w.s.read(chessChoiceOffered, actor)).toBe(false);
  }
);

Then(
  '{actor} is not offered to go back to the game choice',
  async (w, actor: Actor) => {
    expect(await w.s.read(spaceBackOffered, actor)).toBe(false);
  }
);

Then(
  "{actor}'s phone and her other device are taken to chess within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    for (const device of [actor, otherDevice(actor)]) {
      await w.s.until((s) => chessGameMenuVisible(s, device), {
        maxMs: seconds * SECOND_MS,
      });
    }
  }
);

Then(
  "{actor}'s phone is taken to chess within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((s) => chessGameMenuVisible(s, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s phone and her other device see the space's game choice",
  async (w, actor: Actor) => {
    for (const device of [actor, otherDevice(actor)])
      expect(await w.s.read(readPuzzleView, device)).toBe('GameChoice');
  }
);
