import { raw, unsafe } from '@pkgs/sql-shared/sql';
import { SqlClientImplBunPostgres as SqlClientImplPostgresTcp } from '@pkgs/sql-client-postgres-server/impl-bun-postgres';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { cliClock } from '@libs/db-shared/cli-io';
import { fetchSecret } from './secret-io';

export interface DatabasePingResult {
  readonly ok: boolean;
  readonly host?: string;
  readonly durationMs: number;
  readonly error?: string;
}

type ProbeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

async function probeDatabase(url: string): Promise<ProbeResult> {
  const db = SqlClientImplPostgresTcp.connect(url, appPostgresDbScope());
  try {
    await db.connect();
    const rows = await db.query(raw<{ ok: number }>('SELECT 1 AS ok'));
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'SELECT 1 returned no rows' };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await db.disconnect().catch(() => undefined);
  }
}

const CLAIM_TABLE_OWNERSHIP_SQL = `
  DO $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema()
        AND tableowner <> current_user
    LOOP
      EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', current_schema(), r.tablename, current_user);
    END LOOP;
  END$$
`;

async function verifyDatabaseAndClaimOwnership(
  url: string
): Promise<ProbeResult> {
  const db = SqlClientImplPostgresTcp.connect(url, appPostgresDbScope());
  try {
    await db.connect();
    const rows = await db.query(raw<{ ok: number }>('SELECT 1 AS ok'));
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'SELECT 1 returned no rows' };
    }
    try {
      await db.run(unsafe(CLAIM_TABLE_OWNERSHIP_SQL));
    } catch {
      // best-effort ownership claim
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await db.disconnect().catch(() => undefined);
  }
}

let databaseUrlVerifiedInProcess = false;

function tryFetchCachedDbUrlFromEnv(): string | null {
  const url = (process.env['DATABASE_URL'] ?? '').trim();
  if (!url) return null;
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
    ? url
    : null;
}

async function readDbUrlFromSecrets(): Promise<string> {
  let rawUrl = process.env['DATABASE_URL'];
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    const fromSecrets = (await fetchSecret('DATABASE_URL')).trim();
    if (fromSecrets.length > 0) {
      process.env['DATABASE_URL'] = fromSecrets;
      rawUrl = fromSecrets;
    }
  }
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error(
      'DATABASE_URL is not set and could not be read from the secret store'
    );
  }
  const url = rawUrl.trim();
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(
      'DATABASE_URL must start with postgres:// or postgresql://'
    );
  }
  return url;
}

export async function resolveDatabaseUrl(): Promise<string> {
  if (databaseUrlVerifiedInProcess) {
    const cached = tryFetchCachedDbUrlFromEnv();
    if (cached) return cached;
    const url = await readDbUrlFromSecrets();
    process.env['DATABASE_URL'] = url;
    return url;
  }

  const cached = tryFetchCachedDbUrlFromEnv();
  if (cached) {
    const probe = await verifyDatabaseAndClaimOwnership(cached);
    if (probe.ok) {
      process.env['DATABASE_URL'] = cached;
      databaseUrlVerifiedInProcess = true;
      return cached;
    }
  }

  const url = await readDbUrlFromSecrets();
  const probe = await verifyDatabaseAndClaimOwnership(url);
  if (!probe.ok) {
    throw new Error(
      `DATABASE_URL connectivity check failed (SELECT 1): ${probe.error}`
    );
  }

  process.env['DATABASE_URL'] = url;
  databaseUrlVerifiedInProcess = true;
  return url;
}

export async function pingDatabase(): Promise<DatabasePingResult> {
  const start = cliClock.now();
  try {
    const url = (process.env['DATABASE_URL'] ?? '').trim();
    if (!url) {
      return {
        ok: false,
        durationMs: cliClock.now() - start,
        error: 'DATABASE_URL not set',
      };
    }
    const host = new URL(url).host;
    const probe = await probeDatabase(url);
    if (!probe.ok) {
      return {
        ok: false,
        host,
        durationMs: cliClock.now() - start,
        error: probe.error,
      };
    }
    return { ok: true, host, durationMs: cliClock.now() - start };
  } catch (e) {
    return {
      ok: false,
      durationMs: cliClock.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
