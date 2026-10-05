import { expect } from 'bun:test';
import {
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import {
  disconnectMultiplayer,
  reconnectMultiplayer,
} from './multiplayer-connection';
import { multiplayerPeople } from './multiplayer-people';
import {
  acceptedMoves,
  command,
  gameOf,
  givenGame,
  move,
  refusal,
  resignation,
  sameBoards,
} from './multiplayer-world';

Given(
  '{actor} has an account without a connection',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await disconnectMultiplayer(w, actor);
  }
);
When(
  '{actor} finds a chess opponent on another device',
  async (w, actor: Actor) => {
    const device = `${actor}_computer`;
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(findChessOpponent, device);
    w.memo.set(`multiplayer:other:${actor}`, device);
  }
);
Then(
  '{actor} is told finding an opponent needs a connection',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-offline')
    ).toContain('need a connection');
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-error')
    ).toContain('needs a connection');
  }
);
Then(
  '{actor} is told to finish her multiplayer game first',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(
        multiplayerText,
        String(w.memo.get(`multiplayer:other:${actor}`)),
        'multiplayer-command-denial'
      )
    ).toContain('Finish');
  }
);
Then('{actor} is told she has no opponent search to stop', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_NO_SEARCH')
);
Given(
  '{actor} has a new multiplayer game and her phone is offline',
  async (w, actor: Actor) => {
    await givenGame(w, actor, 'bob');
    await disconnectMultiplayer(w, actor);
  }
);
Given(
  "{actor}'s phone was offline when {actor}'s multiplayer move e7 to e5 was accepted",
  async (w, offline: Actor, opponent: Actor) => {
    await givenGame(w, offline, opponent);
    await acceptedMoves(w, ['e2e4']);
    await disconnectMultiplayer(w, offline);
    expect((await move(w, opponent, 'e7e5')).result.ok).toBe(true);
    await w.s.until(
      async (s) => (await multiplayerView(s, opponent)).game?.revision === 2
    );
  }
);
Given(
  "{actor}'s phone was offline when {actor} resigned multiplayer chess",
  async (w, offline: Actor, opponent: Actor) => {
    await givenGame(w, offline, opponent);
    await disconnectMultiplayer(w, offline);
    expect((await resignation(w, opponent)).result.ok).toBe(true);
  }
);
When(
  "{actor}'s phone comes back online for multiplayer chess",
  reconnectMultiplayer
);
When("{actor}'s phone loses its multiplayer connection", disconnectMultiplayer);
Then('{actor} is told multiplayer moves need a connection', (w, actor: Actor) =>
  refusal(w, actor, 'OFFLINE')
);
Then(
  "{actor}'s phone keeps its last known multiplayer board",
  async (w, actor: Actor) => {
    expect(await gameOf(w, actor)).toEqual(
      w.memo.get(`multiplayer:offline-board:${actor}`) as MultiplayerGame
    );
  }
);
Then(
  '{actor} and {actor} see the same multiplayer board with two moves',
  async (w, a: Actor, b: Actor) => {
    expect((await sameBoards(w, a, b, (g) => g.revision === 2)).revision).toBe(
      2
    );
  }
);
Then('{actor} sees she won the multiplayer game', async (w, actor: Actor) => {
  const owner = await w.s.read(accountIdOf, actor);
  const game = await sameBoards(
    w,
    actor,
    'bob',
    (g) => g.outcome !== 'ongoing'
  );
  expect(game.outcome).toBe(game.white_id === owner ? 'white' : 'black');
});
Then(
  '{actor} and {actor} keep the unfinished multiplayer game',
  async (w, a: Actor, b: Actor) => {
    for (const actor of [a, b]) {
      const game = await gameOf(w, actor);
      expect(game.outcome).toBe('ongoing');
      expect(game.id).toBe(
        (w.memo.get('multiplayer:game') as MultiplayerGame).id
      );
    }
  }
);
Then(
  "{actor} sees her multiplayer board and {actor}'s name",
  async (w, actor: Actor, opponent: Actor) => {
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-game')
    ).not.toBeNull();
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-opponent')
    ).toContain(opponent);
  }
);
When(
  "{actor} opens {actor}'s multiplayer game",
  async (w, outsider: Actor, owner: Actor) => {
    const game = await gameOf(w, owner);
    if (!w.memo.get(`multiplayer:watcher:${outsider}`)) await multiplayerPeople(w, [outsider]);
    await w.s.apply(openMultiplayerChess, outsider, game.id);
  }
);
When(
  "{actor} plays e2 to e4 in {actor}'s multiplayer game",
  async (w, outsider: Actor, owner: Actor) => {
    const game = await gameOf(w, owner);
    if (!w.memo.get(`multiplayer:watcher:${outsider}`)) await multiplayerPeople(w, [outsider]);
    await command(w, outsider, 'playMultiplayerMove', {
      gameId: game.id,
      revision: game.revision,
      uci: 'e2e4',
    });
    await w.s.apply(openMultiplayerChess, outsider, game.id);
  }
);
Then(
  '{actor} is told no multiplayer game is available to her',
  async (w, actor: Actor) => {
    await w.s.until(
      async (s) =>
        (await multiplayerText(s, actor, 'multiplayer-unavailable')) !== null
    );
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-unavailable')
    ).toContain('No multiplayer game');
    expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
  }
);
Then(
  '{actor} and {actor} keep the same multiplayer board',
  async (w, a: Actor, b: Actor) => {
    expect(await sameBoards(w, a, b)).toEqual(
      w.memo.get('multiplayer:game') as MultiplayerGame
    );
  }
);
Then(
  "{actor} cannot be matched with {actor}'s deleted account",
  async (w, actor: Actor, deleted: Actor) => {
    await multiplayerPeople(w, [actor]);
    await w.s.apply(givenOpponentSearch, actor);
    await w.s.apply(pairChessOpponents, actor);
    await w.s.until(
      async (s) =>
        (await multiplayerView(s, actor)).search?.standing === 'waiting'
    );
    expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    expect(
      (await w.s.read(multiplayerView, deleted)).search?.standing
    ).not.toBe('waiting');
  }
);
Then('{actor} sees he won the multiplayer game', async (w, actor: Actor) => {
  const owner = await w.s.read(accountIdOf, actor);
  await w.s.until(
    async (s) => (await multiplayerView(s, actor)).game?.outcome === 'black'
  );
  const game = await gameOf(w, actor);
  expect(game.outcome).toBe(game.black_id === owner ? 'black' : 'white');
  expect(game.reason).toBe('account deletion');
});
Then(
  "{actor} is not shown {actor}'s deleted personal details",
  async (w, actor: Actor, deleted: Actor) => {
    await w.s.apply(openMultiplayerChess, actor);
    await w.s.until(
      async (s) =>
        !(await multiplayerText(s, actor, 'multiplayer-opponent'))?.includes(
          deleted
        )
    );
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-opponent')
    ).toContain('Deleted account');
  }
);
