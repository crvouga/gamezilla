import { PUZZLE_TELEMETRY } from '@libs/chess-puzzle-shared/telemetry';
import { chessPuzzlesTopic } from '@libs/chess-root-shared/sync-topics';
import { defineSubServer } from '@libs/sub-shared/server';
import { puzzleImportConsumer } from './puzzle-import-consumer';
import { createPuzzleManagementApp } from './puzzle-management-route';
export function createChessServer() {
  return defineSubServer({
    name: 'chess',
    telemetryEvents: PUZZLE_TELEMETRY,
    // The catalog every device reads: without this grant AWS IoT refuses the
    // subscription and the device drops its whole session, forever.
    pubsubTopics: async () => [chessPuzzlesTopic()],
    routes: (ctx) => createPuzzleManagementApp(ctx.clock),
    registerOutbox(registry) {
      registry.register(puzzleImportConsumer);
    },
  });
}
