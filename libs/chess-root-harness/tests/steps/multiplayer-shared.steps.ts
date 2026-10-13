import { expect } from 'bun:test';

import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { copyGameRecord } from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import {
  shownMultiplayerClock,
  shownMultiplayerText,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import {
  readSpaceLink,
  spaceHostOfflineShown,
} from '@libs/spaces-harness/spaces-ui-reads';
import { multiplayerPeople } from './multiplayer-people';
import { givenGame, playOnOwnBoard, searchFor } from './multiplayer-world';

const SECOND_MS = 1_000;

async function moveList(
  w: HarnessWorld,
  actor: string,
  moves: string
): Promise<void> {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (
        await shownMultiplayerText(s, actor, 'multiplayer-move-list')
      )?.trim() === moves,
    { maxMs: 5 * SECOND_MS }
  );
  expect(
    (
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-move-list')
    )?.trim()
  ).toBe(moves);
}

async function clocks(
  w: HarnessWorld,
  actor: string,
  white: number,
  black: number
): Promise<void> {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (await shownMultiplayerClock(s, actor, 'white')) === white &&
      (await shownMultiplayerClock(s, actor, 'black')) === black,
    { maxMs: 5 * SECOND_MS }
  );
}

Given(
  '{actor} is hosting a space and looking for a chess opponent',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, '5+0');
  }
);

Given(
  "{actor}'s other device is in {actor}'s space",
  async (w, actor: Actor, host: Actor) => {
    await w.s.apply(signInWithGoogle, host);
    await w.s.apply(createSpace, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} has no space`);
    const device = `${actor}_computer`;
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
    await w.s.apply(joinViaLink, device, link);
  }
);

Given(
  '{actor} is looking for a chess opponent and her phone is offline',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, '5+0');
    await cutConnection(w, actor);
  }
);

When(
  '{actor} plays {word} to {word} as a multiplayer move on her other device',
  async (w, actor: Actor, from: string, to: string) => {
    const device = otherDevice(actor);
    await w.s.apply(openMultiplayerChess, device);
    await playOnOwnBoard(w, device, from + to);
  }
);

When(
  '{actor} plays {word} to {word} as a multiplayer move on her phone',
  async (w, actor: Actor, from: string, to: string) => {
    await playOnOwnBoard(w, actor, from + to);
  }
);

Given(
  "{actor}'s multiplayer move e2 to e4 was accepted from her other device",
  async (w, actor: Actor) => {
    await givenGame(w, actor, 'bob');
    const device = otherDevice(actor);
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
    await w.s.apply(openMultiplayerChess, device);
    await playOnOwnBoard(w, device, 'e2e4');
  }
);

When(
  '{actor} copies the game record on another device',
  async (w, actor: Actor) => {
    const device = otherDevice(actor);
    w.memo.set(`multiplayer:copier:${actor}`, device);
    await w.s.apply(copyGameRecord, device);
  }
);

Then(
  'Bob, Carol and Dave see the multiplayer move list {string}',
  async (w, moves: string) => {
    for (const actor of ['bob', 'carol', 'dave'])
      await moveList(w, actor, moves);
  }
);

Then(
  "Bob, Carol and Dave see {int} seconds on White's multiplayer clock and {int} seconds on Black's",
  async (w, white: number, black: number) => {
    for (const actor of ['bob', 'carol', 'dave'])
      await clocks(w, actor, white, black);
  }
);

Then('{actor} is not told the host is offline', async (w, actor: Actor) => {
  await w.s.never((s) => spaceHostOfflineShown(s, actor), {
    forMs: 20 * SECOND_MS,
  });
  expect(await w.s.read(spaceHostOfflineShown, actor)).toBe(false);
});
