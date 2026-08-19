// @io-wall-ok
/**
 * Run definitive `@libs/runtime` Postgres migrations against the local embedded
 * DATABASE_URL (in-process — apps must not import other `@apps/*` packages).
 */

import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { PostgresMigrationRunner } from '@libs/runtime/server/run-postgres-migrations';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';

const io = wallIo();

/** Schema migrate only — Better Auth DDL does not call this origin. */
const BETTER_AUTH_MIGRATE_BASE_URL = 'https://migrate.local';
const MIN_BETTER_AUTH_SECRET_LENGTH = 32;

function randomBytesBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = Math.floor(io.random() * 256);
  }
  return Buffer.from(bytes).toString('base64url');
}

async function resolveBetterAuthMigrateSecret(): Promise<string> {
  const fromEnv = process.env['BETTER_AUTH_SECRET']?.trim() ?? '';
  if (fromEnv.length >= MIN_BETTER_AUTH_SECRET_LENGTH) return fromEnv;
  try {
    const store = createScriptSecretStore();
    const fromStore = (
      await store.getRequired('BETTER_AUTH_SECRET')
    ).readSecretValue();
    if (fromStore.trim().length >= MIN_BETTER_AUTH_SECRET_LENGTH) {
      return fromStore.trim();
    }
  } catch {
    // Offline / Infisical unavailable — seed below.
  }
  // Local sidecar must boot without Infisical (same as api setup-dev-vars).
  const seeded = randomBytesBase64Url(32);
  process.env['BETTER_AUTH_SECRET'] = seeded;
  process.stdout.write(
    '[postgres] BETTER_AUTH_SECRET missing; seeded local random secret for migrate.\n'
  );
  return seeded;
}

export async function runLocalMigrate(): Promise<void> {
  process.stdout.write('[postgres] migrating…\n');
  const betterAuthSecret = await resolveBetterAuthMigrateSecret();
  const dbScope = appPostgresDbScope();
  const logger = createLogger({
    name: 'postgres:migrate',
    now: io.clock.now,
  });
  const { pool, sqlClient } = createPgPool({
    connectionString: LOCAL_DATABASE_URL,
    dbScope,
    max: 1,
  });
  try {
    await new PostgresMigrationRunner({
      sqlClient,
      pool,
      logger,
      dbScope,
      betterAuthSecret,
      betterAuthBaseURL: BETTER_AUTH_MIGRATE_BASE_URL,
    }).run();
  } finally {
    await pool.end();
  }
  process.stdout.write('[postgres] migrate complete\n');
}

if (import.meta.main) {
  await runLocalMigrate();
}
