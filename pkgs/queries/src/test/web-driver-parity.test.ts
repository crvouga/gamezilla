import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { sql, unsafe } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { applyFullMerge } from '../client/merge-applier';
import { ensureFrameworkSchema } from '../client/local-schema';
import { scopeHash } from '../shared/canonical';
import { DOMAIN_DDL, createScenarioClients } from './scenario-fixture';

/**
 * Web-driver parity smoke: same merge/mutate path against a file-backed
 * SQLite (OPFS/expo-sqlite web uses the same SQL surface via SqlClient).
 * Browser COOP/COEP verification is recorded separately in Phase 1 notes.
 */
describe('web-driver-parity', () => {
  test('file-backed merge and mutate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'queries-parity-'));
    const path = join(dir, 'local.db');
    const raw = new Database(path);
    const db = new SqlClientImplBunSqlite(raw);
    await db.connect();
    for (const stmt of DOMAIN_DDL.split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await db.run(unsafe(stmt));
    }
    await ensureFrameworkSchema(db);
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const { setNote } = await import('./scenario-fixture');
    await mutateClient.mutate(setNote, { id: 'w1', body: 'web' });
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'w1', body: 'server', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'w1'}
    `);
    expect(notes[0]?.body).toBe('web');
    await db.disconnect();
  });
});
