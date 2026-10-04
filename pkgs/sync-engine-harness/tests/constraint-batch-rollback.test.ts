import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-shared/sql';
import { pendingNote } from '@pkgs/sync-engine-harness/mutations';
import { createSyncApp } from '@pkgs/sync-engine-server/create-sync-app';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared/v2';
import { z } from 'zod';
import { openRollbackHost } from './postgres-rollback-host';

// An example-app write encounters a real database constraint after earlier work.
const duplicateNote = defineMutation({
  name: 'duplicateNote',
  args: z.object({}),
  constraintErrors: {
    notes_pkey: { code: 'NOTE_EXISTS', message: 'The note already exists.' },
  },
  async run({ tx, env }) {
    await tx.run(
      sql`INSERT INTO folders (id, title, owner_id) VALUES (${'refused-folder'}, ${'Refused work'}, ${env.actorId})`
    );
    await tx.run(
      sql`INSERT INTO notes (id, title, body, owner_id) VALUES (${'Groceries'}, ${'Groceries'}, ${'refused'}, ${env.actorId})`
    );
  },
});

test.each(['pool', 'session', 'bun'] as const)(
  'a real constraint refusal undoes earlier work and leaves its batch usable (%s)',
  async (driver) => {
    // regression: sync-refused-write-left-domain-changes
    // regression: sync-native-postgres-constraint-refusal-retried
    await using host = await openRollbackHost(driver);
    let id = 0;
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'alice',
        deviceId: 'phone',
        accountId: 'alice',
        isAnon: false,
      }),
      getSql: () => host.db,
      queries: {},
      mutations: mutationRegistry([pendingNote, duplicateNote]),
      now: () => 1700000000000,
      createId: () => `constraint-${++id}`,
    });
    const response = await app.request('http://test/mutations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
      },
      body: JSON.stringify({
        mutations: ['milk', 'refused', 'bread'].map((body, index) => ({
          id: `change-${index}`,
          name: body === 'refused' ? duplicateNote.name : pendingNote.name,
          args: JSON.stringify(
            body === 'refused'
              ? {}
              : { id: 'Groceries', title: 'Groceries', body }
          ),
          clientId: 'phone',
          seq: index + 1,
          createdAt: '2023-11-14T22:13:20.000Z',
          originTraceparent: null,
        })),
      }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      verdicts: { status: string; code?: string }[];
    };
    expect(result.verdicts.map((v) => v.status)).toEqual([
      'applied',
      'rejected',
      'applied',
    ]);
    expect(result.verdicts[1]?.code).toBe('NOTE_EXISTS');
    expect(
      await host.db.query(sql<{ body: string }>`SELECT body FROM notes`)
    ).toEqual([{ body: 'bread' }]);
    expect(
      await host.db.query(sql<{ id: string }>`SELECT id FROM folders`)
    ).toEqual([]);
    expect(
      await host.db.query(
        sql<{ code: string }>`SELECT code FROM sync_engine_write_rejections`
      )
    ).toEqual([{ code: 'NOTE_EXISTS' }]);
  },
  30000
);
