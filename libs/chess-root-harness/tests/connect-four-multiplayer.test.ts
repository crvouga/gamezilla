import { expect, test } from 'bun:test';
import {
  connectFourSearchView,
  pairConnectFourOpponents,
  prepareConnectFourSearch,
  submitConcurrentConnectFourDrops,
} from '@libs/connect-four-harness/connect-four-matchmaking';
import { decodeConnectFour } from '@libs/connect-four-shared/connect-four';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import type { OpenHarness } from '@libs/harness/open-harness';
import { openHarness } from './open-chess-harness';

async function paired(s: OpenHarness) {
  await s.apply(prepareConnectFourSearch, 'alice');
  await s.apply(prepareConnectFourSearch, 'bob');
  await s.apply(pairConnectFourOpponents);
  return (
    await s.until((world) => connectFourSearchView(world, 'alice'), {
      pred: (view) => view.game !== null,
    })
  ).game!;
}
async function command(
  s: OpenHarness,
  actor: string,
  name: string,
  args: Record<string, unknown>
) {
  await s.apply(sendMultiplayerCommand, actor, { name, args });
  return (await s.read(multiplayerCommandReply, actor))!.result;
}
async function game(s: OpenHarness) {
  const first = (await s.read(connectFourSearchView, 'alice')).game!;
  const second = await s.until((world) => connectFourSearchView(world, 'bob'), {
    pred: (view) => view.game?.revision === first.revision,
  });
  expect(second.game).toEqual(first);
  return first;
}
test('the shared match authority rejects unauthorized, repeated and stale drops, and rematches retain the result', async () => {
  await using s = await openHarness('connect-four-match-authority');
  let match = await paired(s);
  expect(
    (
      await command(s, 'bob', 'playMultiplayerMove', {
        gameId: match.id,
        revision: 0,
        uci: '3',
        requestId: 'wrong-turn',
      })
    ).ok
  ).toBe(false);
  const move = {
    gameId: match.id,
    revision: 0,
    uci: '0',
    requestId: 'first-drop',
  };
  expect((await command(s, 'alice', 'playMultiplayerMove', move)).ok).toBe(
    true
  );
  expect((await command(s, 'alice', 'playMultiplayerMove', move)).ok).toBe(
    true
  );
  match = await game(s);
  expect(match.revision).toBe(1);
  expect(decodeConnectFour(match.fen).moves).toEqual([0]);
  expect(
    (
      await command(s, 'bob', 'playMultiplayerMove', {
        gameId: match.id,
        revision: 0,
        uci: '1',
        requestId: 'stale-drop',
      })
    ).ok
  ).toBe(false);
  for (const column of [1, 0, 1, 0, 1, 0]) {
    match = await game(s);
    expect(
      (
        await command(
          s,
          match.revision % 2 === 0 ? 'alice' : 'bob',
          'playMultiplayerMove',
          {
            gameId: match.id,
            revision: match.revision,
            uci: String(column),
            requestId: `drop-${match.revision}`,
          }
        )
      ).ok
    ).toBe(true);
  }
  const completed = await game(s);
  expect(completed.outcome).toBe('white');
  expect(decodeConnectFour(completed.fen).moves).toHaveLength(7);
  expect(
    (
      await command(s, 'bob', 'playMultiplayerMove', {
        gameId: completed.id,
        revision: completed.revision,
        uci: '2',
        requestId: 'after-victory',
      })
    ).ok
  ).toBe(false);
  await command(s, 'alice', 'offerMultiplayerRematch', {
    gameId: completed.id,
    requestId: 'offer-rematch',
  });
  await command(s, 'bob', 'acceptMultiplayerRematch', {
    gameId: completed.id,
    requestId: 'accept-rematch',
  });
  const rematch = await game(s);
  expect(rematch.id).not.toBe(completed.id);
  expect(rematch.fen).toBe('c4:1:');
  expect(rematch.white_id).toBe(completed.black_id);
  expect(decodeConnectFour(completed.fen).moves).toHaveLength(7);
}, 120_000);
test('a reconnecting player receives the accepted opponent drop and resumes the same match', async () => {
  await using s = await openHarness('connect-four-match-reconnect');
  const match = await paired(s);
  await command(s, 'alice', 'playMultiplayerMove', {
    gameId: match.id,
    revision: 0,
    uci: '3',
    requestId: 'first',
  });
  await game(s);
  await s.apply(setMultiplayerConnection, 'alice', false);
  await command(s, 'bob', 'playMultiplayerMove', {
    gameId: match.id,
    revision: 1,
    uci: '2',
    requestId: 'while-away',
  });
  await s.apply(setMultiplayerConnection, 'alice', true);
  await s.until((world) => connectFourSearchView(world, 'alice'), {
    pred: (view) => view.game?.revision === 2,
  });
  const restored = await game(s);
  expect(restored.id).toBe(match.id);
  expect(decodeConnectFour(restored.fen).moves).toEqual([3, 2]);
}, 120_000);

test('concurrent requests consume a single turn in the shared authority', async () => {
  await using s = await openHarness('connect-four-concurrent-turn');
  const match = await paired(s);
  await s.apply(submitConcurrentConnectFourDrops, match.id);
  const accepted = await game(s);
  expect(accepted.revision).toBe(1);
  const moves = decodeConnectFour(accepted.fen).moves;
  expect(moves).toHaveLength(1);
  expect(moves[0] === 2 || moves[0] === 4).toBe(true);
}, 120_000);
