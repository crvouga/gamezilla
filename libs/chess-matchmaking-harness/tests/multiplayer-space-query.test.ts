import { expect, test } from 'bun:test';
import { multiplayerSpaceQuery } from '@libs/game-matchmaking-shared/multiplayer-space-query';
import { runQuery } from '@pkgs/sync-engine-server/run-query';
import { queryRegistry } from '@pkgs/sync-engine-shared/queries-registry';
import {
  DEVICE,
  HOST,
  openMultiplayerQueryFixture,
  SPACE,
  TOMBSTONE,
} from './multiplayer-query-fixture';

// regression: chess-space-query-tombstone-filter
test('the multiplayer space snapshot passes server SQL enforcement and includes tombstones', async () => {
  const db = await openMultiplayerQueryFixture();
  try {
    for (const actorId of [HOST, 'watcher']) {
      const response = await runQuery(
        {
          db,
          registry: queryRegistry([multiplayerSpaceQuery]),
          auth: {
            actorId,
            deviceId: actorId === HOST ? DEVICE : 'watcher-device',
            accountId: null,
            isAnon: true,
            now: () => new Date(TOMBSTONE),
          },
          nextCheckpoint: () => '1',
          strictQueryLimits: true,
        },
        { name: 'chessMultiplayerSpace', params: { spaceId: SPACE } }
      );
      expect(response.status).toBe('ok');
      if (response.status !== 'ok') throw new Error('expected snapshot');
      for (const table of [
        'chess_multiplayer_players',
        'chess_multiplayer_games',
        'chess_opponent_searches',
      ]) {
        expect(response.tables[table]).toEqual([
          expect.objectContaining({ deleted_at: TOMBSTONE }),
        ]);
      }
      expect(response.tables['profile']).toEqual([
        expect.objectContaining({
          id: 'opponent',
          deleted_at: TOMBSTONE,
          username: '',
          username_norm: '',
          avatar_config: null,
        }),
      ]);
    }
  } finally {
    await db.disconnect();
  }
});
