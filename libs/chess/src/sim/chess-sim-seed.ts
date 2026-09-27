import type { SqlClient } from '@pkgs/sql-client/interface';
import { createSimIds } from '@pkgs/uuid';

function canSeedFromNodeFs(): boolean {
  if (typeof process === 'undefined') return false;
  // Browser `process` shims may omit `versions`; widen past the Node typings.
  const shim: { readonly versions?: { readonly node?: unknown } } = process;
  return typeof shim.versions?.node === 'string';
}

/** Fixed seed clock / id namespace so web dumps stay byte-stable. */
const SIM_CHESS_WEB_SEED_NOW_MS = 1_700_000_000_000;

/**
 * Every sim that composes chess boots with puzzles, so the chess surface is
 * playable without a manual seed step. Node hosts load the tiny DST CSV
 * (3 documented puzzles the scenario tests exhaust on purpose); the web host
 * (product-simulator / `bun run dev`) inserts the inline 50-row fixture.
 */
export async function seedChessPuzzlesForSim(
  sqlClient: SqlClient
): Promise<void> {
  if (canSeedFromNodeFs()) {
    const { seedSimChessPuzzles } = await import('./seed-sim-chess-puzzles');
    await seedSimChessPuzzles({ sqlClient });
    return;
  }
  const { seedSimChessPuzzlesWeb } = await import(
    './seed-sim-chess-puzzles-web'
  );
  const ids = createSimIds('sim-chess-puzzle-seed-web');
  await seedSimChessPuzzlesWeb({
    sqlClient,
    now: () => SIM_CHESS_WEB_SEED_NOW_MS,
    createId: ids.createId,
  });
}
