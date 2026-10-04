#!/usr/bin/env bun
// @io-wall-ok — CLI composition root: wall clock, filesystem adapter, stdout.

import { resolve } from 'node:path';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { parseArgs } from '@pkgs/observability-cli-shared/args';
import { runCommand } from '@pkgs/observability-cli-shared/commands';
import { peopleByName } from '@pkgs/observability-cli-shared/person-directory';
import { discoverLatestLocalTraceSource } from '@pkgs/observability-cli-shared/source-discovery';
import { SqlMutationTraceIndex } from '@pkgs/observability-cli-shared/sql-mutation-trace-index';
import { SqlPgStatsSource } from '@pkgs/observability-cli-shared/sql-pg-stats';
import { LookupIdentityResolver } from '@pkgs/observability-shared/identity-resolver';
import { LocalExplorerTraceStore } from '@pkgs/observability-shared/local-explorer';
import { NdjsonTraceStore } from '@pkgs/observability-shared/ndjson';
import type { PgStatsSource } from '@pkgs/observability-shared/pg-stats';
import { TempoTraceStore } from '@pkgs/observability-shared/tempo';
import type { TraceStore } from '@pkgs/observability-shared/types';
import { openPgClient } from '@pkgs/sql-client-postgres-server/connect';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import sql from '@pkgs/sql-shared/sql';

const REPO_ROOT = resolve(import.meta.dir, '../../..');

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourceFlag = args.flags['source'];
  const requested =
    typeof sourceFlag === 'string' ? sourceFlag : '.observability';
  const store = await createStore(requested, typeof sourceFlag === 'string');
  const database = await openReadOnlyDatabase();
  try {
    const result = await runCommand(
      {
        store,
        nowMs: wallClock.now(),
        ...(database === null
          ? {}
          : {
              identityResolver: database.identityResolver,
              mutationTraceIndex: database.mutationTraceIndex,
              pgStats: database.pgStats,
            }),
      },
      args
    );
    process.stdout.write(`${result.text}\n`);
    process.exitCode = result.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `obs/v1\nsource: ${store.source}\nstore unreachable: ${message}\nnext: verify --source and read-only credentials\n`
    );
    process.exitCode = 3;
  } finally {
    await database?.disconnect();
  }
}

type IdentityRow = { readonly id: string };

async function openReadOnlyDatabase(): Promise<{
  readonly disconnect: () => Promise<void>;
  readonly identityResolver: LookupIdentityResolver;
  readonly mutationTraceIndex: SqlMutationTraceIndex;
  readonly pgStats: PgStatsSource;
} | null> {
  const connectionString = process.env['OBS_READONLY_DATABASE_URL'];
  if (connectionString === undefined) return null;
  const opened = await openPgClient({
    connectionString,
    dbScope: createPostgresDbScope(
      process.env['OBS_DATABASE_SCHEMA'] ?? 'public'
    ),
    clientOptions: { application_name: 'obs-read-only' },
  });
  return {
    disconnect: () => opened.sqlClient.disconnect(),
    mutationTraceIndex: new SqlMutationTraceIndex(opened.sqlClient),
    pgStats: new SqlPgStatsSource(opened.sqlClient),
    identityResolver: new LookupIdentityResolver({
      async byUsername(value) {
        const rows = await opened.sqlClient.query(sql<IdentityRow>`
          SELECT id
          FROM profile
          WHERE username_norm = ${value}
            AND deleted_at IS NULL
          LIMIT 1
        `);
        return rows[0]?.id ?? null;
      },
      async byEmail(value) {
        const rows = await opened.sqlClient.query(sql<IdentityRow>`
          SELECT id
          FROM idp_users
          WHERE lower(email) = ${value}
            AND deleted_at IS NULL
          LIMIT 1
        `);
        return rows[0]?.id ?? null;
      },
      byName: peopleByName(opened.sqlClient),
    }),
  };
}

async function createStore(
  requested: string,
  explicit: boolean
): Promise<TraceStore> {
  if (requested === 'prod' || requested === 'tempo') {
    const url = process.env['OBS_TEMPO_URL'];
    if (url === undefined)
      throw new Error('OBS_TEMPO_URL is required for --source prod');
    return tempoStore(url);
  }
  if (!explicit && requested === '.observability') {
    const artifacts = nodeStore(resolve(REPO_ROOT, requested));
    const hasArtifacts = (await artifacts.listKeys()).some((key) =>
      key.endsWith('.ndjson')
    );
    if (!hasArtifacts) {
      const discovered = await discoverLatestLocalTraceSource(
        nodeStore(resolve(REPO_ROOT, '.cache/localhost-stack'))
      );
      if (discovered?.kind === 'tempo') return tempoStore(discovered.url);
      if (discovered?.kind === 'ndjson') {
        const source = resolve(discovered.path);
        return new NdjsonTraceStore(nodeStore(source), source);
      }
    }
    return new NdjsonTraceStore(artifacts, resolve(REPO_ROOT, requested));
  }
  if (requested === 'local-explorer') {
    const url =
      process.env['OBS_LOCAL_EXPLORER_URL'] ?? 'http://127.0.0.1:8787';
    return new LocalExplorerTraceStore(url, globalThis.fetch);
  }
  const source = resolve(requested);
  return new NdjsonTraceStore(nodeStore(source), source);
}

function tempoStore(url: string): TempoTraceStore {
  const token = process.env['OBS_TEMPO_TOKEN'];
  const username = process.env['OBS_TEMPO_USER'];
  if (username !== undefined && token === undefined) {
    throw new Error('OBS_TEMPO_USER requires the read-only OBS_TEMPO_TOKEN');
  }
  const parsed = new URL(url);
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error('Tempo URL must be HTTP(S) without embedded credentials');
  }
  return new TempoTraceStore({
    baseUrl: parsed.toString().replace(/\/$/, ''),
    fetch: globalThis.fetch,
    now: wallClock.now,
    ...(token === undefined ? {} : { token }),
    ...(username === undefined ? {} : { username }),
  });
}

function nodeStore(rootDir: string) {
  return createNodeFsObjectStore({
    rootDir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

await main();
