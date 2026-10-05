import { expect } from 'bun:test';
import {
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { givenOpponentSearch } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import type { MultiplayerSearchView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { removeFriend } from '@libs/friends-harness/friends-actions';
import { setupFriendsPair } from '@libs/friends-harness/setup-friends-pair';
import { signInWithGoogleAsAccount, signOut } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { openAccount } from '@libs/harness/shell-actions';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness/profile-actions';
import { createSpace, endSpace } from '@libs/spaces-harness/space-actions';
import { multiplayerPeople } from './multiplayer-people';
import { gameOf, givenGame, sameBoards } from './multiplayer-world';

async function signOutPhone(
  w: import('@libs/harness/spec-world').HarnessWorld,
  actor: Actor
) {
  await w.s.apply(openAccount, actor);
  await w.s.apply(signOut, actor);
}
Given(
  '{actor} signed out on her phone while looking for a chess opponent',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await w.s.apply(givenOpponentSearch, actor);
    await w.s.until(
      async (s) =>
        (await multiplayerView(s, actor)).search?.standing === 'waiting'
    );
    w.memo.set(
      'multiplayer:original-search',
      (await w.s.read(multiplayerView, actor)).search
    );
    await w.s.apply(signInWithGoogleAsAccount, `${actor}_computer`, actor);
    await signOutPhone(w, actor);
  }
);
Given(
  '{actor} signed out on her phone during a multiplayer game with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    await givenGame(w, actor, opponent);
    await signOutPhone(w, actor);
  }
);
When(
  '{actor} opens multiplayer chess on another signed-in device',
  async (w, actor: Actor) => {
    await w.s.apply(openMultiplayerChess, `${actor}_computer`);
  }
);
When(
  '{actor} finds a chess opponent for {word} on her phone',
  async (w, actor: Actor, timeControl: string) => {
    await w.s.apply(findChessOpponent, actor, timeControl);
  }
);
Then(
  '{actor} is looking for her same chess opponent',
  async (w, actor: Actor) => {
    const device = `${actor}_computer`;
    await w.s.until(
      async (s) =>
        (await multiplayerView(s, device)).search?.standing === 'waiting'
    );
    expect((await w.s.read(multiplayerView, device)).search).toEqual(
      w.memo.get('multiplayer:original-search') as MultiplayerSearchView
    );
  }
);
Then(
  "{actor} cannot see the account's private multiplayer game on her phone",
  async (w, actor: Actor) => {
    expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-game')
    ).toBeNull();
  }
);
Given(
  '{actor} renamed herself to {string} during her multiplayer game with {actor}',
  async (w, actor: Actor, name: string, opponent: Actor) => {
    await givenGame(w, actor, opponent);
    await w.s.apply(openMultiplayerChess, actor);
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(setUsername, actor, name);
  }
);
Then(
  "{actor} sees his opponent's username is {string}",
  async (w, actor: Actor, name: string) => {
    await w.s.until(
      async (s) =>
        (await multiplayerText(s, actor, 'multiplayer-opponent'))?.includes(
          name
        ) === true
    );
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-opponent')
    ).toContain(name);
  }
);
Then(
  '{actor} keeps his same multiplayer game with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    expect((await sameBoards(w, actor, opponent)).id).toBe(
      (w.memo.get('multiplayer:game') as MultiplayerGame).id
    );
  }
);
Then(
  '{actor} keeps her same multiplayer game with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    expect((await sameBoards(w, actor, opponent)).id).toBe(
      (w.memo.get('multiplayer:game') as MultiplayerGame).id
    );
  }
);
Given(
  '{actor} ended her space while playing multiplayer chess with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    await givenGame(w, actor, opponent);
    await w.s.apply(createSpace, actor);
    await w.s.apply(endSpace, actor);
  }
);
Given(
  '{actor} removed {actor} from her friends list during their multiplayer game',
  async (w, actor: Actor, opponent: Actor) => {
    await setupFriendsPair(w.s, actor, opponent);
    await givenGame(w, actor, opponent);
    await w.s.apply(removeFriend, actor, opponent);
    expect((await gameOf(w, actor)).outcome).toBe('ongoing');
  }
);
