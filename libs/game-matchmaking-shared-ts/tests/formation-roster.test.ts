import { expect, test } from 'bun:test';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import { NEW_MULTIPLAYER_RATING } from '@libs/game-matchmaking-shared-ts/multiplayer-rating';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { MultiplayerRatingRepository } from '@libs/game-matchmaking-shared-ts/rating-repository';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;
const roster = fc
  .constantFrom(2, 4)
  .chain((size) =>
    fc.shuffledSubarray([...PEOPLE], { minLength: size, maxLength: size })
  );
const history = fc.array(
  fc.record({
    people: roster,
    outcome: fc.constantFrom(
      'ongoing',
      'white',
      'black',
      'red',
      'blue',
      'draw',
      'aborted'
    ),
    deleted: fc.boolean(),
  }),
  { maxLength: 12 }
);

test('batched formation facts preserve eligibility and colour balance for two- and four-seat histories', async () => {
  const db = await openConformanceDb(MULTIPLAYER_TABLES);
  let sequence = 0;
  try {
    await assertProperty(
      'formation roster facts equal accepted history',
      fc.asyncProperty(history, async (rows) => {
        await db.run(
          sql`UPDATE chess_multiplayer_games SET deleted_at = ${'old-fixture'}`
        );
        if (rows.length > 0)
          await db.run(sql`INSERT INTO chess_multiplayer_games
          (id, white_id, black_id, red_id, blue_id, outcome, deleted_at)
          VALUES ${join(
            rows.map(
              (row) => sql`(${`history-${sequence++}`},
            ${row.people[0]}, ${row.people[1]}, ${row.people[2] ?? null}, ${row.people[3] ?? null},
            ${row.outcome}, ${row.deleted ? 'deleted-fixture' : null})`
            )
          )}`);
        const games = new MultiplayerGameRepository(db);
        const owners = ['dave', 'bob', 'nobody', 'alice', 'carol', 'dave'];
        const grouped = await games.formationState(owners);
        expect(grouped.size).toBe(5);
        for (const owner of owners) {
          const finished = rows.filter(
            (row) =>
              !row.deleted && ['white', 'black', 'draw'].includes(row.outcome)
          );
          expect(grouped.get(owner)).toEqual({
            unfinishedCount: await games.unfinishedCount(owner),
            colourBalance: finished.reduce(
              (balance, row) =>
                balance +
                (row.people[0] === owner
                  ? 1
                  : row.people[1] === owner
                    ? -1
                    : 0),
              0
            ),
          });
        }
        expect(await games.formationState([])).toEqual(new Map());
      })
    );
  } finally {
    await db.disconnect();
  }
});

test('batched starting ratings preserve owner identity, speed, null defaults and absent people', async () => {
  const db = await openConformanceDb(MULTIPLAYER_TABLES);
  try {
    await db.run(sql`INSERT INTO chess_multiplayer_ratings
      (id, owner_id, speed, rating, rating_deviation, volatility_micros, games, deleted_at)
      VALUES ('dave-blitz', 'dave', 'blitz', 1670, 90, 55000, 20, NULL),
        ('alice-blitz', 'alice', 'blitz', 1822, NULL, NULL, 12, NULL),
        ('carol-deleted', 'carol', 'blitz', 2500, 80, 55000, 20, 'deleted-fixture'),
        ('dave-daily', 'dave', 'daily', 2100, 80, 55000, 20, NULL)`);
    const ratings = new MultiplayerRatingRepository(db);
    const people = ['bob', 'alice', 'dave', 'carol', 'bob'];
    const batch = await ratings.readMany(people, 'blitz');
    for (const person of people)
      expect(batch.get(person)).toEqual(await ratings.read(person, 'blitz'));
    expect(batch.get('dave')?.rating).toBe(1670);
    expect(batch.get('alice')?.rating).toBe(1822);
    expect(batch.get('bob')).toEqual(NEW_MULTIPLAYER_RATING);
    expect(batch.get('carol')).toEqual(NEW_MULTIPLAYER_RATING);
    expect(await ratings.readMany([], 'blitz')).toEqual(new Map());
  } finally {
    await db.disconnect();
  }
});
