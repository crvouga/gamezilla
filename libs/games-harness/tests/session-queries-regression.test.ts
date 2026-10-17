import { expect, test } from 'bun:test';
import { openGamesHarness as openHarness } from '@libs/games-harness/games-system';
import { signInWithGoogle } from '@libs/harness/auth-actions';

// regression: game-history-inline-query-limit
test('the composed session queries remain available to a second signed-in player', async () => {
  await using s = await openHarness('game-session-queries');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(signInWithGoogle, 'bob');
  const replies = await s.read(async (world) => {
    const env = await world.harness.client('bob');
    const token = await world.actors.get('bob')!.sessionToken();
    const device = await world.actors.get('bob')!.deviceId();
    return Promise.all(
      world.harness.composition.app.sessionQueries.map(async (name) => {
        const response = await env.server(`${env.serverUrl}/api/query`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
            'x-anon-id': device!,
            'x-sync-protocol': '3',
          },
          body: JSON.stringify({ queries: [{ name, params: {} }] }),
        });
        return { name, status: response.status, body: await response.text() };
      })
    );
  });
  expect(replies.filter((r) => r.status !== 200)).toEqual([]);
}, 120_000);
