/**
 * Shared hot-path workloads for sync-engine microbenches.
 * Used by `hot-paths.bench.ts` (timed) and `hot-paths.bench.test.ts` (hang-only).
 */
import { join, sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { migrateLocalSchema } from '../../client/local-schema-migrate';
import { applyFullMerge, type MergeApplierDeps } from '../../client/merge';
import { createMutationClient } from '../../mutations/client/create-mutation-client';
import { recordOptimisticOwnRows } from '../../mutations/client/optimistic-own-rows';
import { createTableChangeBus } from '../../queries/client/table-change-bus';
import { hashQueryTables } from '../../queries/shared/canonical';
import { classify } from '../../sql-ast';
import { acmeLocalSchema, acmeMutationRegistry, setNote } from '../apps/acme';

export type BenchCase = {
  readonly name: string;
  readonly run: () => Promise<void> | void;
};

function mergeEnv() {
  let n = 0;
  return {
    actorId: 'actor',
    deviceId: 'device',
    accountId: 'acct',
    isAnon: false,
    now: () => new Date('2020-01-01T00:00:00.000Z'),
    createId: () => `id-${++n}`,
  };
}

function noteRows(count: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: `n${i}`,
      folder_id: null,
      title: '',
      body: `body-${i}`,
      owner_id: 'actor',
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
      deleted_at: null,
    });
  }
  return rows;
}

const HASH_ROWS = noteRows(2000);
const INSERT_SQL = sql`
  INSERT INTO notes (id, folder_id, title, body, owner_id)
  VALUES (${'n1'}, ${null}, ${''}, ${'x'}, ${'actor'})
  ON CONFLICT (id) DO UPDATE SET
    body = excluded.body,
    owner_id = excluded.owner_id,
    deleted_at = NULL
`;

async function openMergeDeps(): Promise<MergeApplierDeps> {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  await migrateLocalSchema(db, acmeLocalSchema);
  return {
    db,
    registry: acmeMutationRegistry,
    env: mergeEnv(),
    bus: createTableChangeBus(),
    clientId: 'c0',
  };
}

/** Build the cases once fixtures are ready. */
export async function createHotPathCases(): Promise<readonly BenchCase[]> {
  const merge200Deps = await openMergeDeps();
  const merge2000Deps = await openMergeDeps();
  const mutateDeps = await openMergeDeps();
  const rebaseDeps = await openMergeDeps();
  const ownRowDeps = await openMergeDeps();
  const ackDeps = await openMergeDeps();
  for (let i = 0; i < 128; i += 1) {
    await ackDeps.db.run(sql`
      INSERT INTO sync_engine_mutations (
        id, name, args, client_id, seq, created_at
      )
      VALUES (
        ${`ack-${i}`},
        ${'setNote'},
        ${'{}'},
        ${'c0'},
        ${i + 1},
        ${'2020-01-01T00:00:00.000Z'}
      )
    `);
  }

  const mutateClient = createMutationClient({
    db: mutateDeps.db,
    registry: acmeMutationRegistry,
    env: mutateDeps.env,
    ids: { clientId: 'c0' },
    connectivity: { isOnline: () => true },
    createId: mutateDeps.env.createId,
  });

  // Seed pending mutations for rebase bench.
  for (let i = 0; i < 32; i++) {
    await rebaseDeps.db.run(sql`
      INSERT INTO sync_engine_mutations (
        id, name, args, client_id, seq, created_at
      )
      VALUES (
        ${`m${i}`},
        ${'setNote'},
        ${JSON.stringify({ id: `p${i}`, body: `pending-${i}` })},
        ${'c0'},
        ${i + 1},
        ${'2020-01-01T00:00:00.000Z'}
      )
    `);
  }

  let merge200Cp = 0;
  let merge2000Cp = 0;
  let rebaseCp = 0;

  return [
    {
      name: 'hashQueryTables 2000×8-col',
      run: () => {
        hashQueryTables({ notes: HASH_ROWS });
      },
    },
    {
      name: 'classify 1000× same INSERT',
      run: () => {
        for (let i = 0; i < 1000; i++) {
          classify(INSERT_SQL);
        }
      },
    },
    {
      name: 'applyFullMerge 200 rows',
      run: async () => {
        merge200Cp += 1;
        await applyFullMerge(merge200Deps, {
          scopeHash: 'bench-200',
          checkpoint: String(merge200Cp),
          hash: `h-${merge200Cp}`,
          tables: { notes: noteRows(200) },
        });
      },
    },
    {
      name: 'applyFullMerge 2000 rows',
      run: async () => {
        merge2000Cp += 1;
        await applyFullMerge(merge2000Deps, {
          scopeHash: 'bench-2000',
          checkpoint: String(merge2000Cp),
          hash: `h-${merge2000Cp}`,
          tables: { notes: noteRows(2000) },
        });
      },
    },
    {
      name: 'wrapMutationDb upsert mutate',
      run: async () => {
        await mutateClient.mutate(setNote, {
          id: 'bench-note',
          body: 'tap',
        });
      },
    },
    {
      name: 'rebasePending 32 after merge',
      run: async () => {
        rebaseCp += 1;
        await applyFullMerge(rebaseDeps, {
          scopeHash: 'bench-rebase',
          checkpoint: String(rebaseCp),
          hash: `rh-${rebaseCp}`,
          tables: { notes: noteRows(50) },
        });
      },
    },
    {
      name: 'recordOptimisticOwnRows 64 ids',
      run: async () => {
        const ids = Array.from({ length: 64 }, (_, i) => `o${i}`);
        await ownRowDeps.db.transaction(async (tx) => {
          await recordOptimisticOwnRows(tx, 'bench-m', {
            tables: ['notes'],
            ids: { notes: ids },
            images: {},
          });
        });
      },
    },
    {
      name: 'upload ack DELETE 128 ids chunked',
      run: async () => {
        const ids = Array.from({ length: 128 }, (_, i) => `ack-${i}`);
        await ackDeps.db.transaction(async (tx) => {
          const maxIds = 999;
          for (let offset = 0; offset < ids.length; offset += maxIds) {
            const chunk = ids.slice(offset, offset + maxIds);
            await tx.run(sql`
              DELETE FROM sync_engine_mutations
              WHERE id IN (${join(chunk.map((id) => sql`${id}`))})
            `);
          }
        });
        for (let i = 0; i < 128; i += 1) {
          await ackDeps.db.run(sql`
            INSERT INTO sync_engine_mutations (
              id, name, args, client_id, seq, created_at
            )
            VALUES (
              ${`ack-${i}`},
              ${'setNote'},
              ${'{}'},
              ${'c0'},
              ${i + 1},
              ${'2020-01-01T00:00:00.000Z'}
            )
          `);
        }
      },
    },
  ];
}
