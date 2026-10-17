import { expect } from 'bun:test';
import {
  bothBoards,
  gameCommand,
  opponentOf,
  ownerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { givenOverGame } from './multiplayer-world';

async function rematchOfferBy(w: HarnessWorld) {
  return (await bothBoards(w)).rematch_offer_by ?? '';
}

Given(
  "{actor}'s {word} multiplayer game with {actor} is over",
  (w, a: Actor, timeControl: string, b: Actor) =>
    givenOverGame(w, a, b, timeControl)
);
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
When('{actor} offers a multiplayer rematch', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'offerMultiplayerRematch');
});
When('{actor} accepts the multiplayer rematch', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'acceptMultiplayerRematch');
});
When('{actor} declines the multiplayer rematch', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'declineMultiplayerRematch');
});
Then('{actor} is offered a multiplayer rematch', async (w, actor: Actor) => {
  const by = await ownerOf(w, opponentOf(w, actor));
  await bothBoards(w, (g) => g.rematch_offer_by === by);
  expect(await rematchOfferBy(w)).toBe(by);
});

Then(
  '{actor} is not offered a multiplayer rematch',
  async (w, actor: Actor) => {
    expect(await rematchOfferBy(w)).not.toBe(
      await ownerOf(w, opponentOf(w, actor))
    );
  }
);
