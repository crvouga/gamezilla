/**
 * One opponent search follows the account. Another device, even in someone
 * else's space, does not start a second one.
 */

import { searchFor } from '@libs/game-matchmaking-harness/matched-game-world';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { disconnectMultiplayer } from './multiplayer-connection';
import { multiplayerPeople } from './multiplayer-people';

/** The find-on-another-device step addresses this device. */
function searchDevice(actor: Actor): string {
  return `${actor}_computer`;
}

Given(
  '{actor} is hosting a space and looking for a chess opponent',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, '5+0');
    w.memo.set(
      'multiplayer:original-search',
      (await w.s.read(multiplayerView, actor)).search
    );
  }
);

Given(
  "{actor}'s other device is in {actor}'s space",
  async (w, actor: Actor, host: Actor) => {
    await multiplayerPeople(w, [host]);
    const device = searchDevice(actor);
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} has no space`);
    await w.s.apply(joinViaLink, device, link);
    w.memo.set(`multiplayer:other:${actor}`, device);
    w.memo.set(`multiplayer:same-search-device:${actor}`, device);
  }
);

Given(
  '{actor} is looking for a chess opponent and her phone is offline',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, '5+0');
    w.memo.set(
      'multiplayer:original-search',
      (await w.s.read(multiplayerView, actor)).search
    );
    w.memo.set(`multiplayer:same-search-device:${actor}`, actor);
    await disconnectMultiplayer(w, actor);
  }
);
