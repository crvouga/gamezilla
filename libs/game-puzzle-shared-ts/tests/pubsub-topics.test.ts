import { expect, test } from 'bun:test';
import { puzzleContentTopic } from '@libs/game-puzzle-shared-ts/content-topic-map';
import { puzzleCatalogueTopic } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import { GAME_PUZZLE_SERVER } from '@libs/game-puzzle-shared-ts/puzzle-sub-server';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

// regression: mqtt-ungranted-topic-reconnect-loop
test('every device is granted the puzzle catalogue topic its queries subscribe to', async () => {
  const topics = await GAME_PUZZLE_SERVER.pubsubTopics?.({
    actorId: 'anyone',
    db: {} as SqlClient,
  });
  expect(topics).toEqual([puzzleCatalogueTopic(), puzzleContentTopic]);
  expect(topics).toEqual([
    'system:chess_puzzles',
    'system:game-puzzle-content',
  ]);
});
