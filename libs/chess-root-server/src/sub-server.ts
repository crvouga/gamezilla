import { PUZZLE_TELEMETRY } from '@libs/chess-puzzle-shared/telemetry';
import { defineSubServer } from '@libs/sub-shared/server';
import { puzzleImportConsumer } from './puzzle-import-consumer';
import { createPuzzleManagementApp } from './puzzle-management-route';
export function createChessServer() {
  return defineSubServer({
    name: 'chess',
    telemetryEvents: PUZZLE_TELEMETRY,
    routes: (ctx) => createPuzzleManagementApp(ctx.clock),
    registerOutbox(registry) {
      registry.register(puzzleImportConsumer);
    },
  });
}
