import { expect } from 'bun:test';
import {
  bothBoards,
  gameCommand,
  inMatchedGame,
  opponentOf,
  ownerOf,
  pairOf,
  searchFor,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { awaitGameMatch } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { clockShown, daily } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { finishedAt, readyPeople, timeControlFor, told } from './matched-game';

/** Both people see a rematch offer from `offerer`. */
async function rematchOfferedBy(w: HarnessWorld, offerer: string) {
  const by = await ownerOf(w, offerer);
  expect(
    (await bothBoards(w, (g) => g.rematch_offer_by === by)).rematch_offer_by
  ).toBe(by);
}

Given(
  "{actor}'s {word} matched game with {actor} is finished",
  (w, first: string, clock: string, second: string) =>
    finishedAt(w, first, second, clock)
);
Given(
  '{actor} had the first side against {actor} in their finished {word} matched game',
  (w, first: string, second: string, clock: string) =>
    finishedAt(w, first, second, clock)
);
Given(
  '{actor} has offered {actor} a rematch',
  async (w, offerer: string, offered: string) => {
    // Without an earlier matched game, theirs has just finished.
    if (!inMatchedGame(w)) await finishedAt(w, offered, offerer, '5+0');
    expect(
      (await gameCommand(w, offerer, 'offerMultiplayerRematch')).result.ok
    ).toBe(true);
    await rematchOfferedBy(w, offerer);
  }
);
Given(
  "{actor}'s rematch offer ended when he found a new opponent",
  async (w, actor: string) => {
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
  '{actor} has since been paired with {actor} in an unfinished matched game',
  async (w, actor: string, opponent: string) => {
    await readyPeople(w, [opponent]);
    await searchFor(w, actor, timeControlFor(w));
    await w.s.advanceTime(1);
    await searchFor(w, opponent, timeControlFor(w));
    await w.s.apply(awaitGameMatch, actor, opponent, true);
    const opponentId = await ownerOf(w, opponent);
    await w.s.until(async (s) => (await multiplayerView(s, actor)).game, {
      pred: (game) =>
        game?.outcome === 'ongoing' &&
        (game.white_id === opponentId || game.black_id === opponentId),
    });
  }
);

When('{actor} offers a rematch', async (w, actor: string) => {
  await gameCommand(w, actor, 'offerMultiplayerRematch');
});
When('{actor} accepts the rematch', async (w, actor: string) => {
  await gameCommand(w, actor, 'acceptMultiplayerRematch');
});
When('{actor} declines the rematch', async (w, actor: string) => {
  await gameCommand(w, actor, 'declineMultiplayerRematch');
});

Then('{actor} is offered a rematch', (w, actor: string) =>
  rematchOfferedBy(w, opponentOf(w, actor))
);
Then('neither person is offered a rematch', async (w) => {
  const game = await bothBoards(w, (g) => (g.rematch_offer_by ?? '') === '');
  expect(game.rematch_offer_by ?? '').toBe('');
});
Then(
  '{actor} has the second side against {actor} in their new matched game',
  async (w, second: string, first: string) => {
    const firstId = await ownerOf(w, first);
    const secondId = await ownerOf(w, second);
    const fresh = (game: Awaited<ReturnType<typeof multiplayerView>>['game']) =>
      game?.white_id === firstId &&
      game.black_id === secondId &&
      game.outcome === 'ongoing';
    await w.s.until(
      async (s) =>
        fresh((await multiplayerView(s, first)).game) &&
        fresh((await multiplayerView(s, second)).game)
    );
    expect((await w.s.read(multiplayerView, second)).game).toEqual(
      (await w.s.read(multiplayerView, first)).game
    );
  }
);
/** Both people see their matched game is played at `clock`. */
async function playedAt(w: HarnessWorld, clock: string) {
  for (const person of pairOf(w)) {
    await w.s.apply(openFindingAnOpponent, person, gameOf(w).shared.id);
    await w.s.until(
      (s) => shownMultiplayerText(s, person, 'multiplayer-time-control'),
      { pred: (shown) => shown === clockShown(clock) }
    );
    expect((await w.s.read(multiplayerView, person)).game?.time_control).toBe(
      timeControlFor(w, clock)
    );
  }
}

Then(
  'both people see their matched game is played at {word}',
  (w, clock: string) => playedAt(w, clock)
);
Then(
  'both people see their matched game is played at {int} day(s) per move',
  (w, days: number) => playedAt(w, daily(days))
);
Then(
  '{actor} is told an aborted matched game has no rematch',
  (w, actor: string) => told(w, actor, 'CHESS_NO_REMATCH_AFTER_ABORT')
);
Then('{actor} is told the matched game is not over yet', (w, actor: string) =>
  told(w, actor, 'CHESS_GAME_NOT_OVER')
);
Then(
  '{actor} is told {actor} already has another unfinished matched game',
  (w, actor: string) => told(w, actor, 'CHESS_OPPONENT_PLAYING')
);
Then(
  '{actor} is told {actor} is already seeking an opponent',
  (w, actor: string) => told(w, actor, 'CHESS_OPPONENT_LOOKING')
);
Then(
  '{actor} is told only {actor} may accept or decline his rematch offer',
  (w, actor: string) => told(w, actor, 'CHESS_OWN_REMATCH_OFFER')
);
Then('{actor} is told the rematch offer has ended', (w, actor: string) =>
  told(w, actor, 'CHESS_REMATCH_ENDED')
);
