import { expect } from 'bun:test';
import {
  acceptedMoves,
  bothBoards,
  drawnByAgreement,
  gameCommand,
  move,
  opponentOf,
  ownerOf,
  sameBoards,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { givenMultiplayerPosition } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { givenBegunGame, givenGame } from './multiplayer-world';

/** Who a waiting draw offer is from, as both boards show it (empty when none). */
async function drawOfferBy(w: HarnessWorld) {
  return (await bothBoards(w)).draw_offer_by ?? '';
}

Given(
  '{actor} has offered {actor} a multiplayer draw',
  async (w, offerer: Actor, _offered: Actor) => {
    if (!w.memo.has('multiplayer:game')) await givenGame(w);
    expect(
      (await gameCommand(w, offerer, 'offerMultiplayerDraw')).result.ok
    ).toBe(true);
    const by = await ownerOf(w, offerer);
    await bothBoards(w, (g) => g.draw_offer_by === by);
  }
);
Given(
  "{actor}'s {word} multiplayer game with {actor} was drawn by agreement after e4 and e5",
  async (w, a: Actor, timeControl: string, b: Actor) => {
    await givenBegunGame(w, a, b, timeControl);
    await drawnByAgreement(w);
  }
);
When('{actor} offers a multiplayer draw', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'offerMultiplayerDraw');
});
When('{actor} accepts the multiplayer draw', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'acceptMultiplayerDraw');
});
When('{actor} declines the multiplayer draw', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'declineMultiplayerDraw');
});
Then('{actor} is offered a multiplayer draw', async (w, actor: Actor) => {
  const by = await ownerOf(w, opponentOf(w, actor));
  await bothBoards(w, (g) => g.draw_offer_by === by);
  expect(await drawOfferBy(w)).toBe(by);
});

Then('{actor} is not offered a multiplayer draw', async (w, actor: Actor) => {
  expect(await drawOfferBy(w)).not.toBe(await ownerOf(w, opponentOf(w, actor)));
});

/** The scenario's words for how a game was drawn, and the product's reason. */
const DRAW_REASONS: Record<string, string> = {
  'insufficient mating material': 'insufficient material',
  'White running out of time against a bare king':
    'timeout vs insufficient material',
};

export const REPETITION = [
  'g1f3',
  'g8f6',
  'f3g1',
  'f6g8',
  'g1f3',
  'g8f6',
  'f3g1',
];
const POSITIONS: Record<string, readonly [string, string]> = {
  stalemate: ['k7/8/1QK5/8/8/8/8/8 w - - 0 1', 'b6c7'],
  'insufficient mating material': ['7k/8/8/8/8/8/1n6/K1B5 w - - 0 1', 'c1b2'],
  'fifty moves without a pawn move or capture': [
    '7k/8/8/8/8/8/R7/K7 w - - 99 51',
    'a2b2',
  ],
};
Given(
  '{actor} and {actor} have a multiplayer position one move from {}',
  async (w, a: Actor, b: Actor, boundary: string) => {
    const game = await givenGame(w, a, b);
    if (
      boundary === 'its third appearance' ||
      boundary === 'its second appearance'
    ) {
      await acceptedMoves(
        w,
        REPETITION.slice(0, boundary === 'its third appearance' ? 7 : 3)
      );
      w.memo.set('multiplayer:boundary-move', [b, 'f6g8']);
      return;
    }
    const position = POSITIONS[boundary];
    if (position === undefined)
      throw new Error(`Unknown draw boundary ${boundary}`);
    await w.s.apply(givenMultiplayerPosition, a, {
      gameId: game.id,
      fen: position[0],
    });
    await sameBoards(w, a, b, (g) => g.fen === position[0]);
    w.memo.set('multiplayer:boundary-move', [a, position[1]]);
  }
);
When('the person whose turn it is plays that multiplayer move', async (w) => {
  const [actor, uci] = w.memo.get('multiplayer:boundary-move') as [
    string,
    string,
  ];
  await move(w, actor, uci);
});
Then(
  'both people see the multiplayer game is drawn by {}',
  async (w, reason: string) => {
    const game: MultiplayerGame = await bothBoards(
      w,
      (g) => g.outcome === 'draw'
    );
    expect(game.reason).toBe(DRAW_REASONS[reason] ?? reason);
  }
);
