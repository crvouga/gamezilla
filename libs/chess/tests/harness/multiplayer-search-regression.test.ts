import { expect, test } from 'bun:test';
import {
  openMultiplayerChess,
  refreshMultiplayerConnection,
} from '@libs/chess/harness/multiplayer-actions';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/chess/harness/multiplayer-commands';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess/harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess/harness/multiplayer-reads';
import { signInWithGoogle } from '@libs/harness';
import { partition } from '@libs/harness/system/actions';
import { partitionLoadBalancer } from '@libs/harness/system/server-actions';
import { openHarness } from './open-chess-harness';

// regression: chess-search-keyword-namespace
test('a literal accepted opponent request reaches its owner through ordinary sync', async () => {
  await using s = await openHarness('accepted-opponent-request');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(givenOpponentSearch, 'alice', 'request-1');
  await s.until(
    async (world) =>
      (await multiplayerView(world, 'alice')).search?.standing === 'waiting'
  );
  expect((await s.read(multiplayerView, 'alice')).search).toEqual(
    expect.objectContaining({ standing: 'waiting' })
  );
});

// regression: chess-offline-connection-state
test('an offline White device retains its accepted board and refuses e2e4 without a deferred move', async () => {
  await using s = await openHarness('offline-white-e2e4');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(signInWithGoogle, 'bob');
  await s.apply(givenOpponentSearch, 'alice', 'phone-1');
  await s.advanceTime(1);
  await s.apply(givenOpponentSearch, 'bob', 'phone-1');
  await s.apply(pairChessOpponents);
  await s.until(
    async (world) => (await multiplayerView(world, 'alice')).game !== null
  );
  const game = (await s.read(multiplayerView, 'alice')).game!;
  await s.apply(openMultiplayerChess, 'alice');
  await s.apply(partition, 'alice');
  await s.apply(partitionLoadBalancer, 'alice');
  await s.apply(refreshMultiplayerConnection, 'alice');
  await s.until(
    async (world) =>
      (await multiplayerText(world, 'alice', 'multiplayer-offline')) !== null
  );
  await s.apply(sendMultiplayerCommand, 'alice', {
    name: 'playMultiplayerMove',
    args: { gameId: game.id, revision: 0, uci: 'e2e4', requestId: 'move-1' },
  });
  const reply = (await s.read(multiplayerCommandReply, 'alice'))!;
  expect(reply.result.ok).toBe(false);
  if (!reply.result.ok) expect(reply.result.failures[0]?.code).toBe('OFFLINE');
  expect((await s.read(multiplayerView, 'alice')).game).toEqual(game);
});
