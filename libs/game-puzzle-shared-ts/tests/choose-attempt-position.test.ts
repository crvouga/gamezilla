import { expect, test } from 'bun:test';
import { readAttemptPosition } from '@libs/game-puzzle-shared-ts/attempt-store';
import { choosePuzzleContinuationMutation as choose } from '@libs/game-puzzle-shared-ts/choose-attempt-position-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  arrangeAttempt,
  fixtureAttempt,
  replayFirstMove,
} from './attempt-fixture';
import { type ContentFixture, withContentFixture } from './content-fixture';

const CHOICE = {
  attemptId: 'attempt',
  expectedPositionId: 'one',
  positionId: 'start',
  continuationId: 'return-to-start',
};
const chooseFor = (f: ContentFixture, args = CHOICE) =>
  f.db.transaction((tx) => choose.run({ tx, env: f.env }, args));

// regression: puzzle-pending-position-rebase-loses-head
test('choosing an earlier state keeps a fresh head that an older replay cannot revisit', async () => {
  await withContentFixture(async (f) => {
    await arrangeAttempt(f);
    await replayFirstMove(f);
    const start = await readAttemptPosition(
      f.db,
      await fixtureAttempt(f),
      'start'
    );
    await chooseFor(f);
    expect((await fixtureAttempt(f)).current_position_id).toBe(
      CHOICE.continuationId
    );
    const chosen = await readAttemptPosition(
      f.db,
      await fixtureAttempt(f),
      CHOICE.continuationId
    );
    expect(chosen).toMatchObject({
      parent_id: 'one',
      history: start.history,
    });
    expect(Boolean(chosen.conflicted)).toBe(false);
    await replayFirstMove(f);
    expect((await fixtureAttempt(f)).current_position_id).toBe(
      CHOICE.continuationId
    );
    expect(
      await readAttemptPosition(f.db, await fixtureAttempt(f), 'start')
    ).toEqual(start);
    // A pending choice is also replayable after its expected head arrives in a snapshot.
    await f.db.run(
      sql`UPDATE puzzle_content_attempts SET current_position_id = ${'one'} WHERE id = ${'attempt'}`
    );
    await chooseFor(f);
    expect((await fixtureAttempt(f)).current_position_id).toBe(
      CHOICE.continuationId
    );
    expect(
      await readAttemptPosition(
        f.db,
        await fixtureAttempt(f),
        CHOICE.continuationId
      )
    ).toEqual(chosen);
  });
});

test('a stale fresh choice refuses atomically and a reused continuation identity cannot change its history', async () => {
  await withContentFixture(async (f) => {
    await arrangeAttempt(f);
    await replayFirstMove(f);
    await expect(
      chooseFor(f, { ...CHOICE, expectedPositionId: 'start' })
    ).rejects.toMatchObject({ code: 'PUZZLE_CONTINUATION_CHANGED' });
    await expect(
      readAttemptPosition(f.db, await fixtureAttempt(f), CHOICE.continuationId)
    ).rejects.toMatchObject({ code: 'PUZZLE_POSITION_UNAVAILABLE' });
    await chooseFor(f);
    await expect(
      chooseFor(f, { ...CHOICE, positionId: 'one' })
    ).rejects.toMatchObject({ code: 'PUZZLE_POSITION_ID_REUSED' });
    expect((await fixtureAttempt(f)).current_position_id).toBe(
      CHOICE.continuationId
    );
  });
});
