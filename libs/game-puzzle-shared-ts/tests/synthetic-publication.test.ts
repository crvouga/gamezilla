import { expect, test } from 'bun:test';
import {
  SYNTHETIC_PUBLICATION_LIFETIME_MS,
  syntheticPublicationExpiry,
  withdrawExpiredSyntheticPublication,
} from '@libs/game-puzzle-shared-ts/content-publication';
import { CONTENT_TABLES } from '@libs/game-puzzle-shared-ts/content-tables';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { outboxEvents } from '@pkgs/outbox-shared-ts/tables';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';
import {
  type ContentFixture,
  createContentFixture,
  publishContentFixture,
  withContentFixture,
} from './content-fixture';

/** 2026-11-13T00:00:00Z: when the server replays the publication. */
const SERVER_MS = 1_794_528_000_000;

function openContentDb(): Promise<SqlClient> {
  return openConformanceDb([...CONTENT_TABLES, outboxEvents]);
}

async function publication(db: SqlClient, id: string) {
  const rows = await db.query(
    sql<{
      status: string;
      synthetic_at: string | null;
    }>`SELECT status, synthetic_at FROM puzzle_content_publications WHERE id = ${id}`
  );
  return rows[0];
}

async function documentStatus(db: SqlClient, id: string) {
  const rows = await db.query(
    sql<{
      status: string;
    }>`SELECT status FROM puzzle_content_documents WHERE id = ${id}`
  );
  return rows[0]?.status;
}

async function expiries(db: SqlClient) {
  return db.query(
    sql<{
      type: string;
      payload: string;
      available_at: string;
    }>`SELECT type, payload, available_at FROM outbox_events`
  );
}

/** Publish `id` on the server's replay, as monitoring or as a person. */
async function publishOnReplay(
  fixture: ContentFixture,
  id: string,
  synthetic: boolean | undefined
): Promise<void> {
  await createContentFixture(fixture, { id, title: 'River' });
  await publishContentFixture(
    {
      ...fixture,
      env: {
        ...fixture.env,
        ...(synthetic === undefined ? {} : { synthetic }),
        serverNow: () => new Date(SERVER_MS),
      },
    },
    id
  );
}

// regression: synthetic-journey-packs-outlive-their-run
test('a pack monitoring publishes is withdrawn an hour later, even when its run never cleans up', async () => {
  await withContentFixture(
    async (fixture) => {
      await publishOnReplay(fixture, 'health-pack', true);
      expect(await publication(fixture.db, 'health-pack')).toEqual({
        status: 'published',
        synthetic_at: new Date(SERVER_MS).toISOString(),
      });
      const [expiry] = await expiries(fixture.db);
      expect(expiry?.type).toBe(syntheticPublicationExpiry.type);
      expect(JSON.parse(expiry?.payload ?? '{}')).toEqual({
        documentId: 'health-pack',
      });
      expect(Date.parse(expiry?.available_at ?? '')).toBe(
        SERVER_MS + SYNTHETIC_PUBLICATION_LIFETIME_MS
      );
      expect(
        await withdrawExpiredSyntheticPublication(
          fixture.db,
          'health-pack',
          SERVER_MS + SYNTHETIC_PUBLICATION_LIFETIME_MS
        )
      ).toEqual(['alice']);
      expect((await publication(fixture.db, 'health-pack'))?.status).toBe(
        'withdrawn'
      );
      expect(await documentStatus(fixture.db, 'health-pack')).toBe('withdrawn');
    },
    await openContentDb()
  );
});

test("a person's publication, and an optimistic one, record no synthetic time and schedule nothing", async () => {
  await withContentFixture(
    async (fixture) => {
      await publishOnReplay(fixture, 'person', false);
      await publishOnReplay(fixture, 'unknown', undefined);
      await createContentFixture(fixture, { id: 'optimistic', title: 'River' });
      // Optimistic application has no server clock; provenance waits for replay.
      await publishContentFixture(
        { ...fixture, env: { ...fixture.env, synthetic: true } },
        'optimistic'
      );
      for (const id of ['person', 'unknown', 'optimistic'])
        expect((await publication(fixture.db, id))?.synthetic_at).toBeNull();
      expect(await expiries(fixture.db)).toEqual([]);
    },
    await openContentDb()
  );
});

type Row = {
  readonly synthetic: boolean;
  readonly ageMs: number;
  readonly status: 'published' | 'withdrawn';
};

const arbRows = fc.array(
  fc.record({
    synthetic: fc.boolean(),
    ageMs: fc.integer({ min: 0, max: 3 * SYNTHETIC_PUBLICATION_LIFETIME_MS }),
    status: fc.constantFrom<Row['status']>('published', 'withdrawn'),
  }),
  { minLength: 1, maxLength: 8 }
);

function allPublications(db: SqlClient) {
  return db.query(
    sql<
      Record<string, unknown>
    >`SELECT * FROM puzzle_content_publications ORDER BY id`
  );
}

async function seed(db: SqlClient, rows: readonly Row[]): Promise<void> {
  for (const [index, row] of rows.entries()) {
    const at = new Date(SERVER_MS - row.ageMs).toISOString();
    const id = `p${String(index)}`;
    await db.run(sql`
      INSERT INTO puzzle_content_publications
        (id, owner_id, game_id, kind, published_revision_id, publication_count, status, published_at, synthetic_at, created_at, updated_at)
      VALUES (${id}, ${`owner-${id}`}, ${'pile'}, ${'pack'}, ${`${id}-r`}, ${1}, ${row.status},
        ${at}, ${row.synthetic ? at : null}, ${at}, ${at})
    `);
  }
}

test('the sweep withdraws only synthetic publications older than an hour, and a repeat changes nothing', async () => {
  await assertProperty(
    'synthetic publication expiry',
    fc.asyncProperty(arbRows, async (rows) => {
      const db = await openContentDb();
      try {
        await seed(db, rows);
        const sweep = () =>
          Promise.all(
            rows.map((_, index) =>
              withdrawExpiredSyntheticPublication(
                db,
                `p${String(index)}`,
                SERVER_MS
              )
            )
          );
        const first = await sweep();
        for (const [index, row] of rows.entries()) {
          const expired =
            row.synthetic &&
            row.status === 'published' &&
            row.ageMs >= SYNTHETIC_PUBLICATION_LIFETIME_MS;
          expect(first[index]).toEqual(
            expired ? [`owner-p${String(index)}`] : []
          );
          expect((await publication(db, `p${String(index)}`))?.status).toBe(
            expired ? 'withdrawn' : row.status
          );
        }
        const before = await allPublications(db);
        expect((await sweep()).flat()).toEqual([]);
        expect(await allPublications(db)).toEqual(before);
      } finally {
        await db.disconnect();
      }
    })
  );
});
