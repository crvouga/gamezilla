/**
 * Product-harness Commands tab entry: re-seed the chess puzzle pool into the
 * live harness server DB. The web host already seeds on boot; this command exists
 * for sessions restored from older snapshots that predate the auto-seed.
 */

import { seedHarnessChessPuzzlesWeb } from '@libs/chess-puzzle-harness-ts/seed-harness-chess-puzzles-web';
import type { ProductHarnessCommand } from '@pkgs/harness-console-shared-ts/ports';

export function createProductHarnessChessCommands(): ProductHarnessCommand[] {
  return [
    {
      id: 'seed-chess-puzzles',
      label: 'Seed chess puzzles',
      async run(ctx) {
        await seedHarnessChessPuzzlesWeb({
          sqlClient: ctx.serverSql,
          now: ctx.now,
          createId: ctx.createId,
          ...(ctx.notifySyncWake !== undefined
            ? { notifySyncWake: ctx.notifySyncWake }
            : {}),
        });
      },
    },
  ];
}
