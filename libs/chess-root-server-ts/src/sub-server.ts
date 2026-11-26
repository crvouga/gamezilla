import { puzzleCatalogueTopic } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import { defineSubServer } from '@libs/sub-shared-ts/server';
export function createChessServer() {
  return defineSubServer({
    name: 'chess',
    // The catalog every device reads: without this grant AWS IoT refuses the
    // subscription and the device drops its whole session, forever.
    pubsubTopics: async () => [puzzleCatalogueTopic()],
  });
}
