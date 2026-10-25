import { expect, test } from 'bun:test';
import { puzzleContentPublished } from '@libs/game-puzzle-shared-ts/content-queries';
import {
  STARTER_CONTENT_OWNER,
  seedStarterContent,
  starterContentProblems,
} from '@libs/game-puzzle-shared-ts/starter-content';
import sql, { type Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { type ContentFixture, withContentFixture } from './content-fixture';
import { pileContent } from './pile-game';

/** The test pile game, shipping two puzzles and their pack. */
function shipping(witness: readonly string[]): {
  id: string;
  puzzleContent: PuzzleContent;
} {
  const base = pileContent();
  return {
    id: 'pile',
    puzzleContent: {
      ...base,
      validatePublication: (definition, solution) =>
        solution !== undefined &&
        base.rules.complete(definition, solution.state)
          ? { valid: true }
          : {
              valid: false,
              issues: [{ code: 'witness', message: 'not solved' }],
            },
      starter: {
        id: 'first-piles',
        title: 'First piles',
        description: 'Two piles.',
        puzzles: [
          {
            id: 'one',
            title: 'One stone',
            description: '',
            difficulty: 'easy',
            definition: 'pile:1:white',
            witness,
          },
          {
            id: 'two',
            title: 'Two stones',
            description: '',
            difficulty: 'easy',
            definition: 'pile:2:white',
            witness: ['take2'],
          },
        ],
      },
    },
  };
}

function published(fixture: ContentFixture) {
  return puzzleContentPublished.run(
    {
      db: { query: (q: Sql<unknown>) => fixture.db.query(q as Sql<QueryRow>) },
      env: { ...fixture.env, actorId: 'bob', deviceId: 'bob-phone' },
    },
    { gameId: 'pile', afterId: '' }
  );
}

async function revisions(fixture: ContentFixture): Promise<unknown> {
  return fixture.db.query(sql<QueryRow>`
    SELECT id, edition, definition, rules_version FROM puzzle_content_revisions
    WHERE owner_id = ${STARTER_CONTENT_OWNER} ORDER BY id`);
}

test('starter content is proven, then published once for everyone, and seeding again changes nothing', async () => {
  await withContentFixture(async (fixture) => {
    const game = shipping(['take1']);
    expect(starterContentProblems(game)).toEqual([]);
    await fixture.db.transaction((tx) => seedStarterContent(tx, [game], 0));
    const first = await revisions(fixture);
    expect(first).toHaveLength(3);
    expect(JSON.stringify(first)).toContain('"rules_version":1');
    expect(JSON.stringify(await published(fixture))).toContain('First piles');
    await fixture.db.transaction((tx) => seedStarterContent(tx, [game], 1000));
    expect(await revisions(fixture)).toEqual(first);
  });
});

test('an unproven starter puzzle publishes nothing', async () => {
  await withContentFixture(async (fixture) => {
    const game = shipping([]);
    expect(starterContentProblems(game)).toEqual(['pile/one: not solved']);
    await expect(
      fixture.db.transaction((tx) => seedStarterContent(tx, [game], 0))
    ).rejects.toThrow('not proven');
    expect(await revisions(fixture)).toEqual([]);
  });
});
