import { expect } from 'bun:test';
import {
  bothBoards,
  gameCommand,
  ownerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { givenOverGame } from './multiplayer-world';

Given(
  '{actor} was White and {actor} was Black in their finished {word} multiplayer game',
  (w, white: Actor, black: Actor, timeControl: string) =>
    givenOverGame(w, white, black, timeControl)
);
Given(
  '{actor} has offered {actor} a multiplayer rematch',
  async (w, offerer: Actor, _offered: Actor) => {
    if (!w.memo.has('multiplayer:game')) await givenOverGame(w);
    expect(
      (await gameCommand(w, offerer, 'offerMultiplayerRematch')).result.ok
    ).toBe(true);
    const by = await ownerOf(w, offerer);
    await bothBoards(w, (g) => g.rematch_offer_by === by);
  }
);
When('{actor} accepts the multiplayer rematch', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'acceptMultiplayerRematch');
});
