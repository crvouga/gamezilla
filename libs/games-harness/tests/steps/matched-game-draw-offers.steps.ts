import { expect } from 'bun:test';
import {
  bothBoards,
  gameCommand,
  inMatchedGame,
  opponentOf,
  ownerOf,
  sameBoards,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  noCustomGameDrawOffer,
  offeredCustomGameDraw,
} from './custom-game-play-world';
import { choose, toldOf } from './custom-game-set-up-world';
import { drawnAfterFirstMoves, pairedAt, seenOn, told } from './matched-game';

/** Both people see a draw offer from `offerer`. */
async function drawOfferedBy(w: HarnessWorld, offerer: string) {
  const by = await ownerOf(w, offerer);
  expect(
    (await bothBoards(w, (g) => g.draw_offer_by === by)).draw_offer_by
  ).toBe(by);
}

Given(
  '{actor} has offered {actor} a draw in their matched game',
  async (w, offerer: string, offered: string) => {
    if (!inMatchedGame(w)) await pairedAt(w, offerer, offered);
    expect(
      (await gameCommand(w, offerer, 'offerMultiplayerDraw')).result.ok
    ).toBe(true);
    await drawOfferedBy(w, offerer);
  }
);
Given(
  "{actor}'s {word} matched game with {actor} was drawn by agreement after their first moves",
  async (w, first: string, clock: string, second: string) => {
    await drawnAfterFirstMoves(w, first, second, clock);
  }
);

// A matched game's draw offer, else the custom game's.
When('{actor} offers a draw', async (w, actor: string) => {
  if (inMatchedGame(w)) await gameCommand(w, actor, 'offerMultiplayerDraw');
  else await choose(w, actor, { operation: 'offer' });
});
When('{actor} accepts the draw', async (w, actor: string) => {
  if (inMatchedGame(w)) await gameCommand(w, actor, 'acceptMultiplayerDraw');
  else await choose(w, actor, { operation: 'agree' });
});
When('{actor} declines the draw', async (w, actor: string) => {
  if (inMatchedGame(w)) await gameCommand(w, actor, 'declineMultiplayerDraw');
  else await choose(w, actor, { operation: 'reject' });
});

Then('{actor} is (still )offered a draw', (w, actor: string) =>
  inMatchedGame(w)
    ? drawOfferedBy(w, opponentOf(w, actor))
    : offeredCustomGameDraw(w, actor)
);
Then('neither person is offered a draw', async (w) => {
  if (!inMatchedGame(w)) return noCustomGameDrawOffer(w);
  const game = await bothBoards(w, (g) => (g.draw_offer_by ?? '') === '');
  expect(game.draw_offer_by ?? '').toBe('');
});
Then('both people see the matched game is drawn by agreement', async (w) => {
  const game = await bothBoards(w, (g) => g.outcome === 'draw');
  expect(game.reason).toBe('agreement');
});
Then(
  '{actor} sees the matched game is drawn by agreement',
  async (w, actor: string) => {
    const game = await sameBoards(
      w,
      actor,
      seenOn(w, actor),
      (g) => g.outcome === 'draw'
    );
    expect(game.reason).toBe('agreement');
  }
);
Then(
  '{actor} is told only {actor} may accept or decline her draw offer',
  (w, actor: string) =>
    inMatchedGame(w)
      ? told(w, actor, 'CHESS_OWN_DRAW_OFFER')
      : toldOf(w, actor, 'not the other participant')
);
Then('{actor} is told there is no draw offer', (w, actor: string) =>
  told(w, actor, 'CHESS_NO_DRAW_OFFER')
);
