import { expect, test } from 'bun:test';
import {
  readAttemptPosition,
  readContentAttempt,
} from '@libs/game-puzzle-shared-ts/attempt-store';
import { changePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/change-attempt-mutation';
import { startPuzzlePlaytestMutation } from '@libs/game-puzzle-shared-ts/start-playtest-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createContentFixture, withContentFixture } from './content-fixture';

// regression: puzzle-pending-position-rebase-loses-head
test('replaying a pending position restores its head after an earlier snapshot preserves that position', async () => {
  await withContentFixture(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await f.db.transaction((tx) =>
      startPuzzlePlaytestMutation(f.puzzleContents).run(
        { tx, env: f.env },
        {
          documentId: 'river',
          draftId: 'river-first',
          attemptId: 'attempt',
          positionId: 'start',
        }
      )
    );
    const change = changePuzzleAttemptMutation(f.puzzleContents);
    const move = {
      attemptId: 'attempt',
      parentId: 'start',
      positionId: 'one',
      command: { kind: 'play' as const, action: 'take1' },
    };
    await f.db.transaction((tx) => change.run({ tx, env: f.env }, move));
    const saved = await readAttemptPosition(
      f.db,
      (await readContentAttempt(f.db, 'attempt'))!,
      'one'
    );
    // A snapshot upserts the server's earlier head; absent immutable positions stay kept locally.
    await f.db.run(
      sql`UPDATE puzzle_content_attempts SET current_position_id = ${'start'} WHERE id = ${'attempt'}`
    );
    await f.db.transaction((tx) => change.run({ tx, env: f.env }, move));
    expect(
      (await readContentAttempt(f.db, 'attempt'))?.current_position_id
    ).toBe('one');
    expect(
      await readAttemptPosition(
        f.db,
        (await readContentAttempt(f.db, 'attempt'))!,
        'one'
      )
    ).toEqual(saved);
    await f.db.transaction((tx) =>
      change.run(
        { tx, env: f.env },
        { ...move, parentId: 'one', positionId: 'two' }
      )
    );
    await f.db.transaction((tx) => change.run({ tx, env: f.env }, move));
    expect(
      (await readContentAttempt(f.db, 'attempt'))?.current_position_id
    ).toBe('two');
  });
});
