import { execFileSync } from 'node:child_process';

import { openPgClient } from '@pkgs/sql-client/postgres-connect';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-schema';

const CHESS_PUZZLE_ENTITY_TYPE = 'chess.puzzle';
const MIN_PUZZLES = 50;
const SEED_LIMIT = 500;

async function countChessPuzzles(): Promise<number> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  const schema = process.env['POSTGRES_SCHEMA']?.trim() || 'public';
  const { client, sqlClient } = await openPgClient({
    connectionString: databaseUrl,
    dbScope: createPostgresDbScope(schema),
  });
  try {
    const rows = await sqlClient.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM snapshots WHERE entity_type = ?',
      [CHESS_PUZZLE_ENTITY_TYPE]
    );
    return rows[0]?.n ?? 0;
  } finally {
    await client.end();
  }
}

function seedChessPuzzles(repoRoot: string): void {
  execFileSync(
    'bun',
    [
      'run',
      '--filter',
      '@libs/chess',
      'seed:puzzles',
      '--',
      '--limit',
      String(SEED_LIMIT),
      '--profile',
      'managed',
    ],
    { cwd: repoRoot, stdio: 'inherit', env: process.env }
  );
}

/** Ensures hosted dev Postgres has enough chess puzzles for browser E2E. */
export async function ensureChessPuzzlesSeeded(
  repoRoot: string
): Promise<void> {
  const count = await countChessPuzzles();
  if (count >= MIN_PUZZLES) {
    process.stdout.write(
      `[chess-e2e] chess.puzzle count ${count} (>= ${MIN_PUZZLES}); skip seed\n`
    );
    return;
  }
  process.stdout.write(
    `[chess-e2e] chess.puzzle count ${count} < ${MIN_PUZZLES}; seeding up to ${SEED_LIMIT}…\n`
  );
  seedChessPuzzles(repoRoot);
}
