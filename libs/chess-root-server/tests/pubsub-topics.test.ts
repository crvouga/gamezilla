import { expect, test } from 'bun:test';
import { createChessServer } from '@libs/chess-root-server/sub-server';
import { puzzleCatalogueTopic } from '@libs/game-puzzle-shared/puzzle-catalogue';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

// regression: mqtt-ungranted-topic-reconnect-loop
test('every device is granted the puzzle catalog topic its queries subscribe to', async () => {
  const topics = await createChessServer().pubsubTopics?.({
    actorId: 'anyone',
    db: {} as SqlClient,
  });
  expect(topics).toEqual([puzzleCatalogueTopic()]);
});
