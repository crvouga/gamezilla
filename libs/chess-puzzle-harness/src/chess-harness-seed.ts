import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';

function canSeedFromNodeFs(): boolean {
  if (typeof process === 'undefined') return false;
  // Browser `process` shims may omit `versions`; widen past the Node typings.
  const shim: { readonly versions?: { readonly node?: unknown } } = process;
  return typeof shim.versions?.node === 'string';
}

/** Fixed seed clock / id namespace so web dumps stay byte-stable. */
const HARNESS_CHESS_WEB_SEED_NOW_MS = 1_700_000_000_000;

/**
 * Every harness that composes chess boots with puzzles, so the chess surface is
 * playable without a manual seed step. Node hosts load the tiny DST CSV
 * (3 documented puzzles the scenario tests exhaust on purpose); the web host
 * (product-harness / `bun run dev`) inserts the inline 50-row fixture.
 */
export async function seedChessPuzzlesForHarness(
  sqlClient: SqlClient
): Promise<void> {
  if (canSeedFromNodeFs()) {
    const { seedHarnessChessPuzzles } = await import(
      './seed-harness-chess-puzzles'
    );
    await seedHarnessChessPuzzles({ sqlClient });
    return;
  }
  const { seedHarnessChessPuzzlesWeb } = await import(
    './seed-harness-chess-puzzles-web'
  );
  const ids = createHarnessIds('harness-chess-puzzle-seed-web');
  await seedHarnessChessPuzzlesWeb({
    sqlClient,
    now: () => HARNESS_CHESS_WEB_SEED_NOW_MS,
    createId: ids.createId,
  });
}
