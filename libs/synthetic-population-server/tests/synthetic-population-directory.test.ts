import { expect, test } from 'bun:test';
import {
  readSyntheticPopulationDirectory,
  syntheticPopulationDirectoryQuery,
} from '@libs/synthetic-population-server/synthetic-population-user-directory';
import sql from '@pkgs/sql-root-shared/sql';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

test('directory pages are bounded, searchable and independent of worker accounting', async () => {
  const f = await syntheticPopulationFixture(3);
  try {
    await f.controller.claim(f.workers[0]!);
    await f.controller.claim(f.workers[0]!);
    await f.controller.claim(f.workers[1]!);
    const first = await readSyntheticPopulationDirectory(
      f.db,
      syntheticPopulationDirectoryQuery.parse({ limit: 1 })
    );
    const second = await readSyntheticPopulationDirectory(
      f.db,
      syntheticPopulationDirectoryQuery.parse({
        limit: 1,
        cursor: first.nextCursor,
      })
    );
    expect(first.users).toHaveLength(1);
    expect(second.users).toHaveLength(1);
    expect(second.users[0]!.id).not.toBe(first.users[0]!.id);
    expect(first.users[0]).not.toHaveProperty('email');
    expect(first.users[0]).not.toHaveProperty('inspection');
    const user = second.users[0]!;
    await f.db.run(
      sql`UPDATE population_users SET username = ${'Cedar_100%'} WHERE id = ${user.id}`
    );
    const found = await readSyntheticPopulationDirectory(
      f.db,
      syntheticPopulationDirectoryQuery.parse({ q: 'cedar_100%' })
    );
    expect(found.users.map((row) => row.id)).toEqual([user.id]);
    const absent = await readSyntheticPopulationDirectory(
      f.db,
      syntheticPopulationDirectoryQuery.parse({ q: 'nobody' })
    );
    expect(absent.users).toEqual([]);
    expect(absent.nextCursor).toBeNull();
    const overview = await f.admin.overview();
    expect(overview.online).toBe(3);
    expect(overview.workerAssignments).toContainEqual({
      worker_id: f.workers[0]!,
      count: 2,
    });
    expect(overview.workerAssignments).toContainEqual({
      worker_id: f.workers[1]!,
      count: 1,
    });
    expect(
      syntheticPopulationDirectoryQuery.safeParse({ limit: 101 }).success
    ).toBe(false);
  } finally {
    await f.db.disconnect();
  }
});
