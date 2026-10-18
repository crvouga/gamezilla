/**
 * A matched game belongs to its people's accounts, whichever game it is:
 * signing out, renaming, ending a space and removing a friend leave it as
 * it is, and account deletion stops the search and gives up the game.
 */

import { expect } from 'bun:test';
import { removeFriend } from '@libs/friends-harness/friends-actions';
import { setupFriendsPair } from '@libs/friends-harness/setup-friends-pair';
import {
  matchedGameOf,
  ownerOf,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import {
  openFindingAnOpponent,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { signOut } from '@libs/harness/auth-actions';
import { Given, Then } from '@libs/harness/define';
import { openAccount } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness/profile-actions';
import { closeSpaceScreen, endSpace } from '@libs/spaces-harness/space-actions';
import { seeking } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { otherDevice, pairedAt } from './matched-game';

function open(w: HarnessWorld, device: string) {
  return w.s.apply(openFindingAnOpponent, device, gameOf(w).shared.id);
}

async function signOutPhone(w: HarnessWorld, actor: string) {
  await w.s.apply(openAccount, actor);
  await w.s.apply(signOut, actor);
}

Given(
  '{actor} signed out on her phone while seeking an opponent for the game',
  async (w, actor: string) => {
    await seeking(w, actor, '5+0');
    // Her other device is signed in to the account before the phone leaves.
    await otherDevice(w, actor);
    await signOutPhone(w, actor);
  }
);
Given(
  '{actor} signed out on her phone during her matched game with {actor}',
  async (w, actor: string, opponent: string) => {
    await pairedAt(w, actor, opponent);
    await signOutPhone(w, actor);
  }
);
Then(
  "{actor} cannot see the account's matched game on her phone",
  async (w, actor: string) => {
    expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-game')
    ).toBeNull();
  }
);

Given(
  '{actor} renamed herself to {username} during her matched game with {actor}',
  async (w, actor: string, name: string, opponent: string) => {
    await pairedAt(w, actor, opponent);
    await open(w, actor);
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(setUsername, actor, name);
  }
);
Then(
  "{actor} sees his opponent's username is {username}",
  async (w, actor: string, name: string) => {
    await open(w, actor);
    await w.s.until(
      (s) => shownMultiplayerText(s, actor, 'multiplayer-opponent'),
      { pred: (shown) => shown?.includes(name) === true }
    );
    expect(
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-opponent')
    ).toContain(name);
  }
);
Given(
  '{actor} ended her space during her matched game with {actor}',
  async (w, actor: string, opponent: string) => {
    await pairedAt(w, actor, opponent);
    await open(w, actor);
    await w.s.apply(endSpace, actor);
  }
);
Given(
  '{actor} removed {actor} from her friends list during their matched game',
  async (w, actor: string, opponent: string) => {
    await setupFriendsPair(w.s, actor, opponent);
    await pairedAt(w, actor, opponent);
    await w.s.apply(closeSpaceScreen, actor);
    await w.s.apply(removeFriend, actor, opponent);
    expect((await matchedGameOf(w, actor)).outcome).toBe('ongoing');
  }
);

Then(
  "{actor} cannot be paired with {actor}'s deleted account",
  async (w, actor: string, deleted: string) => {
    await w.s.apply(seekGameOpponent, actor, gameOf(w).shared.id);
    await w.s.apply(pairGameOpponents, actor);
    await w.s.until(async (s) => (await multiplayerView(s, actor)).search, {
      pred: (search) => search?.standing === 'waiting',
    });
    expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    expect(
      (await w.s.read(multiplayerView, deleted)).search?.standing
    ).not.toBe('waiting');
  }
);
Then(
  "{actor} is not shown {actor}'s deleted personal details",
  async (w, actor: string, deleted: string) => {
    await open(w, actor);
    await w.s.until(
      (s) => shownMultiplayerText(s, actor, 'multiplayer-opponent'),
      { pred: (shown) => shown !== null && !shown.includes(deleted) }
    );
    expect(
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-opponent')
    ).toContain('Deleted account');
  }
);

Then(
  '{actor} sees he won the matched game by account deletion',
  async (w, actor: string) => {
    const owner = await ownerOf(w, actor);
    const device = viewerOf(w, actor);
    await w.s.until(
      async (s) => (await multiplayerView(s, device)).game?.outcome,
      { pred: (outcome) => outcome !== undefined && outcome !== 'ongoing' }
    );
    const game = await matchedGameOf(w, device);
    expect(game.outcome).toBe(game.white_id === owner ? 'white' : 'black');
    expect(game.reason).toBe('account deletion');
  }
);
