import { expect } from 'bun:test';
import {
  awaitGameMatch,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';
import {
  bothBoards,
  gameCommand,
  givenOverGame,
  ownerOf,
  pairOf,
  refusal,
} from './multiplayer-world';

async function rematchOfferBy(w: HarnessWorld) {
  return (await bothBoards(w)).rematch_offer_by ?? '';
}

function otherOf(w: HarnessWorld, actor: string) {
  const [white, black] = pairOf(w);
  return actor === white ? black : white;
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
Given(
  "{actor}'s multiplayer rematch offer ended when he found a new opponent",
  async (w, actor: Actor) => {
    expect(
      (await gameCommand(w, actor, 'offerMultiplayerRematch')).result.ok
    ).toBe(true);
    expect(
      (await gameCommand(w, actor, 'findNewChessOpponent')).result.ok
    ).toBe(true);
    await bothBoards(w, (g) => (g.rematch_offer_by ?? '') === '');
  }
);
Given(
  '{actor} has since started an unfinished multiplayer game with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    await multiplayerPeople(w, [opponent]);
    await w.s.apply(givenOpponentSearch, actor, '5+0');
    await w.s.advanceTime(1);
    await w.s.apply(givenOpponentSearch, opponent, '5+0');
    await w.s.apply(awaitGameMatch, actor, opponent, true);
    const opponentId = await ownerOf(w, opponent);
    await w.s.until(async (s) => {
      const game = (await multiplayerView(s, actor)).game;
      return (
        game?.outcome === 'ongoing' &&
        (game.white_id === opponentId || game.black_id === opponentId)
      );
    });
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
  const by = await ownerOf(w, otherOf(w, actor));
  await bothBoards(w, (g) => g.rematch_offer_by === by);
  expect(await rematchOfferBy(w)).toBe(by);
});

Then(
  '{actor} is not offered a multiplayer rematch',
  async (w, actor: Actor) => {
    expect(await rematchOfferBy(w)).not.toBe(
      await ownerOf(w, otherOf(w, actor))
    );
  }
);
Then('neither person is offered a multiplayer rematch', async (w) => {
  await bothBoards(w, (g) => (g.rematch_offer_by ?? '') === '');
  expect(await rematchOfferBy(w)).toBe('');
});
Then(
  '{actor} is told an aborted multiplayer game has no multiplayer rematch',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_NO_REMATCH_AFTER_ABORT')
);
Then(
  '{actor} is told the multiplayer game is not over yet',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_GAME_NOT_OVER')
);
Then(
  '{actor} is told {actor} is already playing another multiplayer game',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_OPPONENT_PLAYING')
);
Then(
  '{actor} is told he is already looking for a chess opponent',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_ALREADY_LOOKING')
);
Then(
  '{actor} is told {actor} is already looking for a chess opponent',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_OPPONENT_LOOKING')
);
Then(
  '{actor} is told only {actor} may answer his multiplayer rematch offer',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_OWN_REMATCH_OFFER')
);
Then(
  '{actor} is told the multiplayer rematch offer has ended',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_REMATCH_ENDED')
);
