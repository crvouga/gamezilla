import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  refusal,
  searchFor,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { disconnectMultiplayer } from './multiplayer-connection';
import { multiplayerPeople } from './multiplayer-people';
import { givenOverGame } from './multiplayer-world';

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
