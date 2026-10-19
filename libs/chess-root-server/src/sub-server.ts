import { puzzleCatalogueTopic } from '@libs/game-puzzle-shared/puzzle-catalogue';
import { defineSubServer } from '@libs/sub-shared/server';
import { puzzleImportConsumer } from './puzzle-import-consumer';
import { createPuzzleManagementApp } from './puzzle-management-route';
export function createChessServer() {
  return defineSubServer({
    name: 'chess',
    // The catalog every device reads: without this grant AWS IoT refuses the
    // subscription and the device drops its whole session, forever.
    pubsubTopics: async () => [puzzleCatalogueTopic()],
    routes: (ctx) => createPuzzleManagementApp(ctx.clock),
    registerOutbox(registry) {
      registry.register(puzzleImportConsumer);
    },
  });
}
