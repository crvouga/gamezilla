/**
 * Product-simulator Commands tab entry: re-seed the chess puzzle pool into the
 * live sim server DB. The web host already seeds on boot; this command exists
 * for sessions restored from older snapshots that predate the auto-seed.
 */

import { seedSimChessPuzzlesWeb } from '@libs/chess/sim/seed-sim-chess-puzzles-web';
import type { ProductSimulatorCommand } from '@pkgs/sim-console/client';

export function createProductSimulatorChessCommands(): ProductSimulatorCommand[] {
  return [
    {
      id: 'seed-chess-puzzles',
      label: 'Seed chess puzzles',
      async run(ctx) {
        await seedSimChessPuzzlesWeb({
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
