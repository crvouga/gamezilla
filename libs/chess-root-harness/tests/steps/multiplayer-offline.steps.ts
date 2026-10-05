import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { pairChessOpponents } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { disconnectMultiplayer } from './multiplayer-connection';
import { multiplayerPeople } from './multiplayer-people';
import {
  givenOverGame,
  ownerOf,
  refusal,
  searchFor,
} from './multiplayer-world';

Given(
  '{actor} is looking for a {word} chess opponent and her phone is offline',
  async (w, actor: Actor, timeControl: string) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, timeControl);
    await disconnectMultiplayer(w, actor);
  }
);
Given(
  "{actor}'s {word} multiplayer game with {actor} is over and her phone is offline",
  async (w, actor: Actor, timeControl: string, opponent: Actor) => {
    await givenOverGame(w, actor, opponent, timeControl);
    await disconnectMultiplayer(w, actor);
  }
);
Then(
  '{actor} is told multiplayer chess needs a connection',
  (w, actor: Actor) => refusal(w, actor, 'OFFLINE')
);
Then(
  '{actor} sees she is still looking for a {word} chess opponent',
  async (w, actor: Actor, timeControl: string) => {
    await w.s.apply(openMultiplayerChess, actor);
    expect(
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-waiting')
    ).toContain(`Looking for a ${timeControl} chess opponent`);
  }
);

/** Controls the person's multiplayer screen does not offer. */
async function notOffered(
  w: HarnessWorld,
  actor: string,
  testIds: readonly string[]
) {
  await w.s.apply(openMultiplayerChess, actor);
  for (const testId of testIds)
    expect(await w.s.read(shownMultiplayerText, actor, testId)).toBeNull();
}

Given(
  '{actor} has a free account and has never played a multiplayer game',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
  }
);
Then(
  '{actor} cannot resign multiplayer chess, abort the multiplayer game or offer a multiplayer draw',
  (w, actor: Actor) =>
    notOffered(w, actor, [
      'multiplayer-resign',
      'multiplayer-abort',
      'multiplayer-offer-draw',
    ])
);
Then(
  '{actor} cannot find a new opponent or offer a multiplayer rematch',
  (w, actor: Actor) =>
    notOffered(w, actor, [
      'multiplayer-new-opponent',
      'multiplayer-offer-rematch',
    ])
);

Given(
  '{actor} is White in a new {word} multiplayer game with {actor} and her phone has been offline since they were matched',
  async (w, white: Actor, timeControl: string, black: Actor) => {
    await multiplayerPeople(w, [white, black]);
    await searchFor(w, white, timeControl);
    await w.s.advanceTime(1);
    await searchFor(w, black, timeControl);
    await disconnectMultiplayer(w, white);
    await w.s.apply(pairChessOpponents, white, true);
    w.memo.set('multiplayer:pair', [white, black]);
    const blackId = await ownerOf(w, black);
    await w.s.until(
      async (s) => (await multiplayerView(s, black)).game?.black_id === blackId
    );
  }
);
