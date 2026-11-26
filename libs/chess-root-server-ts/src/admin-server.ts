import { defineSubServer } from '@libs/sub-shared-ts/server';
import { puzzleImportConsumer } from './puzzle-import-consumer';
import { createPuzzleManagementApp } from './puzzle-management-route';
import { createChessServer } from './sub-server';

export function createChessAdminServer() {
  return defineSubServer({
    ...createChessServer(),
    registerOutbox(registry) {
      registry.register(puzzleImportConsumer);
    },
    routes: (ctx) => createPuzzleManagementApp(ctx.clock),
  });
}
