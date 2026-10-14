import { expect } from 'bun:test';
import {
  changeCustomGame,
  openCustomGame,
} from '@libs/chess-custom-game-harness/custom-game-actions';
import {
  readCustomGameBoard,
  reviewCustomGame,
} from '@libs/chess-custom-game-harness/custom-game-review';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import {
  customGameFenAt,
  customGameLegalMoves,
} from '@libs/chess-custom-game-shared/custom-game-position';
import type { CustomGame } from '@libs/chess-custom-game-shared/custom-game-state';
import { restoreNetwork } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import { leaveSpace } from '@libs/spaces-harness/space-actions';
import {
  customDefault,
  customFact,
  customGame,
  customHost,
  customMembers,
  customPerson,
  customScreen,
  customSpace,
  customStart,
} from './custom-game-world';

Given(
  '{actor} has returned online after an offline claim was refused',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await w.s.apply(changeCustomGame, actor, {
      operation: 'claim',
      side: 'black',
    });
    expect((await w.s.read(readCustomGameProbe, actor))?.error).toBe(
      'connection needed'
    );
    await w.s.apply(restoreNetwork);
    await w.s.until(
      async () =>
        (await w.s.read(readCustomGameProbe, actor))?.connected === true,
      { maxMs: 5000 }
    );
  }
);
Given("{actor} has left {actor}'s space", async (w, actor: string) => {
  await w.s.apply(leaveSpace, actor);
  customMembers(w).delete(actor);
});
Given(
  '{actor} has left the space after releasing Black',
  async (w, actor: string) => {
    await customFact(w, actor, { operation: 'claim', side: 'black' });
    await w.s.apply(leaveSpace, actor);
    customMembers(w).delete(actor);
  }
);
Given(
  '{actor} has claimed Black in the Custom Game',
  async (w, actor: string) => {
    await customSpace(w, customHost(w), [actor]);
    await customFact(w, actor, { operation: 'claim', side: 'black' });
  }
);
Given(
  '{actor} has a cancelled Custom Game that invited {actor} to Black',
  async (w, host: string, actor: string) => {
    await customDefault(w, host);
    await customSpace(w, host, [actor]);
    const probe = await w.s.read(readCustomGameProbe, actor);
    if (probe === null) throw new Error(`${actor} sees no game review`);
    if (probe === null) throw new Error('invitee has no game screen');
    await customFact(w, host, {
      operation: 'invite',
      side: 'black',
      person: probe.myId,
    });
    await customFact(w, host, { operation: 'cancel' });
  }
);
Given(
  '{actor} has an active Custom Game against a bot as Black',
  async (w, host: string) => {
    await customDefault(w, host);
    await customFact(w, host, { operation: 'bot', side: 'black' });
    await customFact(w, host, {
      operation: 'clock',
      minutes: 5,
      increment: 2,
    });
    await customStart(w);
  }
);

Given(
  '{actor} has played e2-e4 in the Custom Game while offline',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await w.s.apply(changeCustomGame, actor, {
      operation: 'move',
      uci: 'e2e4',
      ply: 0,
    });
    await w.s.until(
      async () =>
        (await w.s.read(readCustomGameProbe, actor))?.current?.moves.length ===
        2,
      { maxMs: 5000 }
    );
    w.memo.set(
      'offline-custom-moves',
      (await w.s.read(readCustomGameProbe, actor))?.current?.moves
    );
  }
);

When(
  '{actor} reviews move {int} of the Custom Game',
  async (w, actor: string, ply: number) =>
    w.s.apply(reviewCustomGame, actor, ply)
);

Then(
  '{actor} (still )sees the active Custom Game with White to move',
  async (w, actor: string) => {
    await customScreen(w, actor);
    await w.s.apply(openCustomGame, actor);
    const game = await customGame(w, actor);
    expect(game.status).toBe('active');
    expect(game.turn).toBe('white');
    expect((await w.s.read(readCustomGameProbe, actor))?.gates['watch']).toBe(
      true
    );
  }
);
Then('{actor} sees the completed Custom Game', async (w, actor: string) => {
  await customScreen(w, actor);
  await w.s.apply(openCustomGame, actor);
  expect((await customGame(w, actor)).status).toBe('completed');
});
Then(
  '{actor} cannot move pieces in the Custom Game',
  async (w, actor: string) => {
    await w.s.apply(openCustomGame, actor);
    expect(
      (await w.s.read(readCustomGameBoard, actor))?.interactive ?? false
    ).toBe(false);
  }
);
Then(
  '{actor} sees the Custom Game starting board',
  async (w, actor: string) => {
    const probe = await w.s.read(readCustomGameProbe, actor);
    if (probe === null) throw new Error(`${actor} sees no game review`);
    expect(probe?.reviewPly).toBe(0);
    const fen = customGameFenAt(await customGame(w), 0);
    if (fen === null) throw new Error('game has no starting position');
    expect(probe.displayFen).toBe(fen);
    expect((await w.s.read(readCustomGameBoard, actor))?.fen).toBe(
      probe.displayFen
    );
  }
);
Then(
  'White is {actor} and Black is {actor} in the configuring Custom Game',
  async (w, white: string, black: string) => {
    const probe = await w.s.read(readCustomGameProbe, customHost(w));
    const whiteId = customPerson(w, white);
    const blackId = customPerson(w, black);
    expect(probe?.current?.status).toBe('configuring');
    expect(probe?.current?.white).toEqual({ kind: 'person', person: whiteId });
    expect(probe?.current?.black).toEqual({ kind: 'person', person: blackId });
  }
);
Then(
  'White is an open place and Black is {actor} in the configuring Custom Game',
  async (w, black: string) => {
    const game = await customGame(w);
    expect(game.status).toBe('configuring');
    expect(game.white.kind).toBe('open');
    expect(game.black).toEqual({
      kind: 'person',
      person: customPerson(w, black),
    });
  }
);
Then(
  'The earlier Custom Game still shows e4 and its resignation outcome',
  async (w) => {
    const probe = await w.s.read(readCustomGameProbe, customHost(w));
    const earlier = w.memo.get('custom-completed') as CustomGame;
    expect(
      probe?.history
        .find((game) => game.id === earlier.id)
        ?.moves.map((move) => move.san)
    ).toEqual(['e4']);
    expect(probe?.history.find((game) => game.id === earlier.id)?.outcome).toBe(
      earlier.outcome
    );
  }
);
Then('The new Custom Game has no moves', async (w) =>
  expect((await customGame(w)).moves).toEqual([])
);
Then(
  'A legal Black bot move follows within {int} seconds',
  async (w, seconds: number) => {
    const before = await customGame(w);
    expect(before.turn).toBe('black');
    expect(before.black.kind).toBe('bot');
    const legal = customGameLegalMoves(before);
    await w.s.until(
      async () =>
        (await customGame(w)).moves.length === before.moves.length + 1,
      { maxMs: seconds * 1000 }
    );
    const game = await customGame(w);
    expect(legal).toContain(game.moves.at(-1)?.uci ?? '');
    expect(game.moves.slice(0, before.moves.length)).toEqual(before.moves);
  }
);

Then('The Custom Game keeps the opening move and the bot reply', async (w) => {
  const game = await customGame(w);
  expect(game.moves).toHaveLength(2);
  expect(game.moves[0]?.san).toBe('e4');
  expect(game.moves).toEqual(
    w.memo.get('offline-custom-moves') as CustomGame['moves']
  );
});
