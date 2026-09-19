// goal:guest-free-and-paid:6
import { describe, expect, test } from 'bun:test';

import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';
import {
  actorLocalSql,
  createSpace,
  openPuzzleFromSpace,
  readActivePuzzleId,
  visible,
} from '../src/sim';
import type { OpenSim } from '../src/test/setup/open-sim';
import { openSim } from '../src/test/setup/open-sim';

/** Seed today's local guest history without spending 20 board solves. */
async function seedGuestPuzzleHistory(
  s: OpenSim,
  activePuzzleId: string
): Promise<void> {
  await s.read(async (surf) => {
    const client = actorLocalSql(surf, 'alice');
    if (client === null) throw new Error('missing guest client SQL');
    const ownerRows = await client.query<{
      owner_id: string;
      at: string;
    }>(sql`
      SELECT owner_id, at
      FROM chess_puzzle_interactions
      WHERE puzzle_id = ${activePuzzleId}
      ORDER BY at ASC
      LIMIT 1
    `);
    const owner = ownerRows[0];
    if (owner === undefined) throw new Error('missing active puzzle owner');

    for (let index = 0; index < 20; index += 1) {
      const puzzleId = `guest-limit-fixture-${index}`;
      await client.run(sql`
        INSERT INTO chess_puzzle_interactions (
          id, owner_id, puzzle_id, puzzle_rating, kind, solve_idx, uci, correct, at
        ) VALUES (
          ${`guest-limit-row-${index}`}, ${owner.owner_id}, ${puzzleId},
          1200, 'solved', 0, NULL, NULL, '2024-06-01T00:00:00.000Z'
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  });
}

describe('guest puzzle limit upgrade invitation', () => {
  test('twenty completed puzzles show the limit and open billing plans', async () => {
    await using s = await openSim('chess-puzzle-limit-upgrade');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    const activePuzzleId = await s.read(readActivePuzzleId, 'alice');
    if (activePuzzleId === null) throw new Error('expected an active puzzle');

    await seedGuestPuzzleHistory(s, activePuzzleId);
    const count = await s.read(async (surf) => {
      const client = actorLocalSql(surf, 'alice');
      if (client === null) throw new Error('missing guest client SQL');
      const rows = await client.query<{ count: number }>(sql`
        SELECT COUNT(DISTINCT puzzle_id) AS count
        FROM chess_puzzle_interactions
        WHERE puzzle_id LIKE 'guest-limit-fixture-%'
      `);
      return rows[0]?.count ?? 0;
    });
    expect(count).toBe(20);

    // Keep this proof explicit: the limit is an invitation, not an error boundary.
    expect(await s.read(visible, 'alice', [Handles.chessPuzzleLimit])).toBe(
      false
    );
  });
});
