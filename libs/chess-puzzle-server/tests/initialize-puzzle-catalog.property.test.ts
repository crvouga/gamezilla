import { expect, test } from 'bun:test';
import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from '@libs/chess-puzzle-server/load-file-constants';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import sql from '@pkgs/sql-root-shared/sql';
import fc from 'fast-check';
import { csv, openCatalog } from './initialize-puzzle-catalog-fixture';

const input = fc.record({
  id: fc.uuid(),
  rating: fc.integer({ min: 400, max: 3000 }),
  removed: fc.boolean(),
  deployments: fc.integer({ min: 1, max: 5 }),
});

test('deploying changed reference data preserves initialized catalogs and removals', async () => {
  await assertProperty(
    'deploying changed reference data preserves initialized catalogs and removals',
    fc.asyncProperty(input, async ({ id, rating, removed, deployments }) => {
      const catalog = await openCatalog(csv(id, rating));
      try {
        expect((await catalog.initialize.run())?.rowsInserted).toBe(1);
        if (removed) {
          await catalog.db.run(sql`
            UPDATE chess_puzzles SET deleted_at = '2026-10-05T07:25:00Z'
            WHERE id = ${id}
          `);
        }
        const rows = () =>
          catalog.db.query(
            sql<
              Record<string, unknown>
            >`SELECT * FROM chess_puzzles ORDER BY id`
          );
        const before = await rows();
        for (let deployment = 0; deployment < deployments; deployment++) {
          await writeUtf8(
            catalog.store,
            CHESS_PUZZLES_LOAD_FILE_RELATIVE,
            csv(`${id}-changed-${deployment}`, rating + 1)
          );
          expect(await catalog.initialize.run()).toBeNull();
          expect(await rows()).toEqual(before);
        }
        expect(catalog.pushes).toHaveLength(1);
      } finally {
        await catalog.close();
      }
    })
  );
});
