import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert';
import { ThrowingCrashHandler } from '@pkgs/assert/crash/crash-handler/crash-handler-throwing';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

import { defineQuery } from '../core/define-query';
import { queryRegistry } from '../core/registry';
import { runQuery } from '../server/run-query';
import { hashQueryTables } from '../shared/canonical';
import { openScenarioDb } from './scenario-fixture';

describe('query harness stubs', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = assert.registerCrashHandler(new ThrowingCrashHandler());
  });
  afterAll(() => {
    disposeCrash();
  });

  test('authorize-denied', async () => {
    const db = await openScenarioDb();
    const denied = defineQuery({
      name: 'secret',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      async authorize() {
        return false;
      },
      async run() {
        return { notes: [{ id: 'x' }] };
      },
    });
    const res = await runQuery(
      {
        db,
        registry: queryRegistry([denied]),
        auth: {
          actorId: 'a',
          deviceId: 'd',
          accountId: null,
          isAnon: true,
          now: () => new Date(),
        },
        nextCheckpoint: () => '1',
      },
      { name: 'secret', params: {} }
    );
    expect(res.status).toBe('denied');
  });

  test('hard-limit-enforcement', async () => {
    const db = await openScenarioDb();
    for (let i = 0; i < 5; i++) {
      await db.run(sql`
        INSERT INTO notes (id, body, owner_id)
        VALUES (${`n${i}`}, ${'b'}, ${'a'})
      `);
    }
    const limited = defineQuery({
      name: 'notesLim',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 2,
      async run(ctx) {
        const rows = await ctx.db.query(sql`
          SELECT id, body, owner_id FROM notes ORDER BY id
        `);
        return { notes: rows };
      },
    });
    const res = await runQuery(
      {
        db,
        registry: queryRegistry([limited]),
        auth: {
          actorId: 'a',
          deviceId: 'd',
          accountId: null,
          isAnon: true,
          now: () => new Date(),
        },
        nextCheckpoint: () => '1',
      },
      { name: 'notesLim', params: {} }
    );
    expect(res.status).toBe('ok');
    if (res.status === 'ok' && res.mode === 'full') {
      expect(res.tables['notes']?.length).toBe(2);
    }
  });

  test('hash-not_modified', async () => {
    const tables = { notes: [{ id: '1', body: 'x' }] };
    const hash = hashQueryTables(tables);
    const db = await openScenarioDb();
    const q = defineQuery({
      name: 'notesHash',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 10,
      async run() {
        return tables;
      },
    });
    const res = await runQuery(
      {
        db,
        registry: queryRegistry([q]),
        auth: {
          actorId: 'a',
          deviceId: 'd',
          accountId: null,
          isAnon: true,
          now: () => new Date(),
        },
        nextCheckpoint: () => '1',
      },
      { name: 'notesHash', params: {}, lastHash: hash }
    );
    expect(res.status).toBe('not_modified');
  });

  test('registry-duplicate-name', () => {
    const q = defineQuery({
      name: 'dup',
      params: z.object({}),
      hydrates: ['notes'],
      limit: 1,
      async run() {
        return {};
      },
    });
    let message = '';
    try {
      queryRegistry([q, q]);
    } catch (e) {
      message = String((e as { message?: string }).message ?? e);
    }
    expect(message).toMatch(/Duplicate query name/);
  });

  test('missing-limit-rejected', () => {
    let message = '';
    try {
      defineQuery({
        name: 'bad',
        params: z.object({}),
        hydrates: ['notes'],
        limit: 0,
        async run() {
          return {};
        },
      });
    } catch (e) {
      message = String((e as { message?: string }).message ?? e);
    }
    expect(message).toMatch(/hard limit/);
  });
});

