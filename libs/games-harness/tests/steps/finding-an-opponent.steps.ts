import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  providerEvent,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { billingTier } from '@libs/billing-harness/billing-reads';
import {
  matchedGameOf,
  sameBoards,
  searchFor,
} from '@libs/game-matchmaking-harness/matched-game-world';
import {
  multiplayerCommandReply,
  multiplayerRefusalCode,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
  waitingSearchCount,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import {
  openFindingAnOpponent,
  opponentSearchView,
  seekGameOpponent,
  stopSeekingOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import { backToTabs } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  daily,
  notWaiting,
  seek,
  seeking,
  waiting,
} from './finding-an-opponent-world';
import { anotherGame, gameOf } from './game-world';
import {
  actingDevice,
  actOnOtherDevice,
  otherDevice,
  readyPeople,
  timeControlFor,
  told,
} from './matched-game';
import { pairUp } from './matched-game-pairing';

/** The matched game the scenario paired, as it was set up. */
function pairedGame(w: HarnessWorld): MultiplayerGame {
  const game = w.memo.get('multiplayer:game') as MultiplayerGame | undefined;
  if (game === undefined) throw new Error('No matched game was set up');
  return game;
}

// An account, with no space yet: seeking an opponent starts one.
Given(
  '{actor} has a free account and a connection',
  async (w, actor: string) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(backToTabs, actor);
  }
);
Given(
  '{actor} has an account without a connection',
  async (w, actor: string) => {
    await readyPeople(w, [actor]);
    await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
    await w.s.apply(setMultiplayerConnection, actor, false);
    await w.s.until((s) => multiplayerText(s, actor, 'multiplayer-offline'), {
      pred: (shown) => shown !== null,
    });
  }
);
Given(
  '{actor} and {actor} are seeking an opponent for the game at the same clock choice',
  async (w, a: string, b: string) => {
    await w.s.apply(seekGameOpponent, a, gameOf(w).shared.id);
    await w.s.apply(seekGameOpponent, b, gameOf(w).shared.id);
  }
);
Given(
  '{actor} and {actor} are seeking an opponent for the game at {word}',
  async (w, a: string, b: string, clock: string) => {
    await seeking(w, a, clock);
    await w.s.advanceTime(1);
    await seeking(w, b, clock);
  }
);
Given(
  '{actor} and {actor} are seeking an opponent for the game at {int} day(s) per move',
  async (w, a: string, b: string, days: number) => {
    await seeking(w, a, daily(days));
    await w.s.advanceTime(1);
    await seeking(w, b, daily(days));
  }
);
Given(
  '{actor} seeks an opponent for the game and {actor} seeks an opponent for another game',
  async (w, a: string, b: string) => {
    await w.s.apply(seekGameOpponent, a, gameOf(w).shared.id);
    await w.s.apply(
      seekGameOpponent,
      b,
      anotherGame(w, 'matchmaking').shared.id
    );
  }
);
Given(
  '{actor} is seeking an opponent for the game',
  async (w, actor: string) => {
    await w.s.apply(seekGameOpponent, actor, gameOf(w).shared.id);
  }
);
Given(
  '{actor} is seeking an opponent for the game at {word}',
  (w, actor: string, clock: string) => seeking(w, actor, clock)
);
Given(
  '{actor} is seeking an opponent for the game at {int} day(s) per move',
  (w, actor: string, days: number) => seeking(w, actor, daily(days))
);
Given(
  '{actor} is the only person seeking an opponent for the game at {word}',
  async (w, actor: string, clock: string) => {
    await seeking(w, actor, clock);
    expect(await w.s.read(waitingSearchCount)).toBe(1);
  }
);
Given(
  "{actor}'s paid access ended while she was seeking an opponent for the game at {word}",
  async (w, actor: string, clock: string) => {
    await readyPeople(w, [actor]);
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
    await searchFor(w, actor, timeControlFor(w, clock));
    await w.s.apply(observeMembership, actor, 'period_end');
    await w.s.apply(providerEvent, actor, 'refund');
    await w.s.apply(openBilling, actor);
    await w.s.until((s) => billingTier(s, actor), {
      pred: (tier) => tier === 'free',
    });
  }
);

When(
  '{actor} seeks an opponent for the game at {word}',
  (w, actor: string, clock: string) => seek(w, actor, clock)
);
When(
  '{actor} seeks an opponent for the game at {int} day(s) per move',
  (w, actor: string, days: number) => seek(w, actor, daily(days))
);
When(
  '{actor} seeks an opponent for the game at {word} on another device',
  async (w, actor: string, clock: string) => {
    const device = await otherDevice(w, actor);
    actOnOtherDevice(w, actor, device);
    await seek(w, actor, clock, device);
  }
);
When('they are paired', (w) => pairUp(w));
When('people are paired up', async (w) => {
  await w.s.apply(pairGameOpponents);
});
When('{actor} stops seeking an opponent', async (w, actor: string) => {
  await w.s.apply(stopSeekingOpponent, actor);
});

Then(
  '{actor} and {actor} receive the same new game on opposite sides',
  async (w, a: string, b: string) => {
    const seen = [];
    for (const actor of [a, b]) {
      await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
      seen.push(
        await w.s.until((s) => opponentSearchView(s, actor), {
          pred: (view) => view.game !== null && view.board,
        })
      );
    }
    const [first, second] = seen;
    expect(first!.game).toEqual(second!.game);
    expect(first!.game!.white_id).not.toBe(first!.game!.black_id);
    expect(first!.game!.fen).toBe(gameOf(w).shared.turnGame.rules.initial());
  }
);
Then('the first side has the first turn', async (w) => {
  const game = await matchedGameOf(w, 'alice');
  expect(game.turn).toBe(game.white_id);
  expect(game.revision).toBe(0);
});
Then(
  '{actor} and {actor} are not paired together',
  async (w, a: string, b: string) => {
    expect((await w.s.read(opponentSearchView, a)).game).toBeNull();
    expect((await w.s.read(opponentSearchView, b)).game).toBeNull();
  }
);
Then(
  '{actor} and {actor} are still waiting for other opponents',
  async (w, a: string, b: string) => {
    for (const actor of [a, b]) {
      await waiting(w, actor);
      expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    }
  }
);
Then(
  '{actor} is no longer waiting for an opponent',
  async (w, actor: string) => {
    const view = await w.s.until((s) => opponentSearchView(s, actor), {
      pred: (value) => !value.waiting,
    });
    expect(view.search?.standing).not.toBe('waiting');
    expect(view.game).toBeNull();
  }
);
Then(
  '{actor} is (still )waiting for an opponent at {word}',
  (w, actor: string, clock: string) => waiting(w, actor, clock)
);
Then(
  '{actor} is waiting for an opponent at {int} day(s) per move',
  (w, actor: string, days: number) => waiting(w, actor, daily(days))
);
Then('{actor} is not waiting for an opponent', (w, actor: string) =>
  notWaiting(w, actor)
);
Then('{actor} is invited to sign in', async (w, actor: string) => {
  expect(
    await w.s.read(multiplayerText, actor, 'multiplayer-access-denial')
  ).toContain('Sign in');
});
Then(
  '{actor} is told finding an opponent needs a connection',
  async (w, actor: string) => {
    const device = actingDevice(w, actor);
    expect(
      await w.s.read(multiplayerText, device, 'multiplayer-offline')
    ).toContain('need a connection');
    // A screen that took the request tells it there; a stale one is refused.
    if ((await w.s.read(multiplayerCommandReply, device)) === null)
      expect(
        await w.s.read(multiplayerText, device, 'multiplayer-error')
      ).toContain('needs a connection');
    else await told(w, actor, 'OFFLINE');
  }
);
Then(
  '{actor} is told {word} is not an offered clock choice',
  (w, actor: string) => told(w, actor, 'CHESS_TIME_CONTROL_NOT_OFFERED')
);
Then(
  '{actor} is told {int} day(s) per move is not an offered clock choice',
  (w, actor: string) => told(w, actor, 'CHESS_TIME_CONTROL_NOT_OFFERED')
);
Then(
  '{actor} is told she/he is already seeking an opponent',
  (w, actor: string) => told(w, actor, 'CHESS_ALREADY_LOOKING')
);
Then(
  '{actor} is told to finish her matched game first',
  async (w, actor: string) => {
    expect(await w.s.read(multiplayerRefusalCode, actingDevice(w, actor))).toBe(
      'limit_reached'
    );
  }
);
Then(
  '{actor} is told to finish her custom game first',
  async (w, actor: string) => {
    expect(await w.s.read(multiplayerRefusalCode, actingDevice(w, actor))).toBe(
      'restricted'
    );
  }
);
Then('{actor} is told she has no search to stop', (w, actor: string) =>
  told(w, actor, 'CHESS_NO_SEARCH')
);
Then(
  '{actor} keeps her/his matched game with {actor}',
  async (w, a: string, b: string) => {
    expect((await sameBoards(w, a, b)).id).toBe(pairedGame(w).id);
  }
);
Then(
  '{actor} and {actor} keep the same matched game and board',
  async (w, a: string, b: string) => {
    expect(await sameBoards(w, a, b)).toEqual(pairedGame(w));
  }
);
