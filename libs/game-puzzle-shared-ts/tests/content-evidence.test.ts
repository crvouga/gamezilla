import { expect, test } from 'bun:test';
import { changePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/change-attempt-mutation';
import { readContentDraft } from '@libs/game-puzzle-shared-ts/content-store';
import { publishPuzzleContentMutation as publish } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { savePuzzleContentDraftMutation as save } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { startPuzzlePlaytestMutation as playtest } from '@libs/game-puzzle-shared-ts/start-playtest-mutation';
import { validatePuzzleContentDraftMutation as validate } from '@libs/game-puzzle-shared-ts/validate-content-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import {
  CONTENT_BODY,
  type ContentFixture,
  createContentFixture,
  withContentFixture,
} from './content-fixture';
import { pileContent } from './pile-game';

/** A game whose publication needs evidence, as Sokoban's does. */
function provenPile(rulesVersion = 1): PuzzleContent {
  return {
    ...pileContent(),
    rulesVersion,
    validatePublication: (_definition, evidence) =>
      evidence === undefined
        ? {
            valid: false,
            issues: [{ code: 'NEEDS_PLAYTEST', message: 'Playtest first.' }],
          }
        : { valid: true },
  };
}

function withProvenPile(
  run: (fixture: ContentFixture) => Promise<void>
): Promise<void> {
  return withContentFixture((fixture) =>
    run({
      ...fixture,
      puzzleContents: createPuzzleContentCatalog([
        { id: 'pile', puzzleContent: provenPile() },
      ]),
    })
  );
}

async function playTo(
  f: ContentFixture,
  draftId: string,
  actions: readonly string[]
): Promise<void> {
  await f.db.transaction((tx) =>
    playtest(f.puzzleContents).run(
      { tx, env: f.env },
      {
        documentId: 'river',
        draftId,
        attemptId: `${draftId}-test`,
        positionId: `${draftId}-0`,
      }
    )
  );
  for (const [index, action] of actions.entries())
    await f.db.transaction((tx) =>
      changePuzzleAttemptMutation(f.puzzleContents).run(
        { tx, env: f.env },
        {
          attemptId: `${draftId}-test`,
          parentId: `${draftId}-${index}`,
          positionId: `${draftId}-${index + 1}`,
          command: { kind: 'play', action },
        }
      )
    );
}

function publishWith(
  f: ContentFixture,
  draftId: string,
  playtestAttemptId?: string
): Promise<void> {
  return f.db.transaction((tx) =>
    publish(f.puzzleContents).run(
      { tx, env: f.env },
      {
        documentId: 'river',
        draftId,
        ...(playtestAttemptId === undefined ? {} : { playtestAttemptId }),
      }
    )
  );
}

function saveBody(
  f: ContentFixture,
  parentId: string,
  draftId: string,
  body: Partial<typeof CONTENT_BODY>
): Promise<void> {
  return f.db.transaction((tx) =>
    save.run(
      { tx, env: f.env },
      {
        documentId: 'river',
        parentId,
        draftId,
        body: { ...CONTENT_BODY, ...body },
      }
    )
  );
}

test('a completed playtest of the exact definition is replayed and publishes it', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await expect(publishWith(f, 'river-first')).rejects.toMatchObject({
      code: 'PUZZLE_PUBLICATION_INVALID',
    });
    await playTo(f, 'river-first', ['take1', 'take2']);
    await publishWith(f, 'river-first', 'river-first-test');
    const rows = await f.db.query(
      sql<{
        rules_version: number;
      }>`SELECT rules_version FROM puzzle_content_revisions WHERE id = ${'river-first'}`
    );
    expect(rows.map((row) => Number(row.rules_version))).toEqual([1]);
  });
});

test('an unfinished playtest or a playtest of another definition is not evidence', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await playTo(f, 'river-first', ['take1']);
    await expect(
      publishWith(f, 'river-first', 'river-first-test')
    ).rejects.toMatchObject({ code: 'PUZZLE_PUBLICATION_INVALID' });
    await playTo(f, 'river-first', []);
    await saveBody(f, 'river-first', 'bigger', { definition: 'pile:2:white' });
    await expect(publishWith(f, 'bigger', 'river-first-test')).rejects.toThrow(
      'The puzzle changed after this playtest'
    );
  });
});

test('details-only edits keep replayable evidence while board edits drop it', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await playTo(f, 'river-first', ['take1', 'take2']);
    await f.db.transaction((tx) =>
      validate(f.puzzleContents).run(
        { tx, env: f.env },
        {
          documentId: 'river',
          draftId: 'river-first',
          playtestAttemptId: 'river-first-test',
        }
      )
    );
    await saveBody(f, 'river-first', 'renamed', { title: 'Valley' });
    await saveBody(f, 'renamed', 'edited', { definition: 'pile:2:white' });
    expect(
      (await readContentDraft(f.db, 'edited'))?.validation_solution
    ).toBeNull();
    await expect(publishWith(f, 'edited')).rejects.toMatchObject({
      code: 'PUZZLE_PUBLICATION_INVALID',
    });
    await saveBody(f, 'edited', 'restored', { title: 'Valley' });
    await expect(publishWith(f, 'restored')).rejects.toMatchObject({
      code: 'PUZZLE_PUBLICATION_INVALID',
    });
  });
});

test('details-only edits publish from the kept evidence without another playtest', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await playTo(f, 'river-first', ['take2', 'take1']);
    await f.db.transaction((tx) =>
      validate(f.puzzleContents).run(
        { tx, env: f.env },
        {
          documentId: 'river',
          draftId: 'river-first',
          playtestAttemptId: 'river-first-test',
        }
      )
    );
    await saveBody(f, 'river-first', 'renamed', { title: 'Valley' });
    await publishWith(f, 'renamed');
  });
});

// regression: puzzle-evidence-claimed-final-state
test('a kept claim that names a finished state without the moves reaching it is refused', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    for (const claim of [
      'pile:0:white',
      JSON.stringify({ rulesVersion: 1, actions: ['take1'] }),
      JSON.stringify({ rulesVersion: 1, actions: ['take2', 'take2'] }),
      JSON.stringify({ rulesVersion: 1, actions: [], state: 'pile:0:white' }),
    ]) {
      await f.db.run(
        sql`UPDATE puzzle_content_drafts SET validation_solution = ${claim} WHERE id = ${'river-first'}`
      );
      await expect(publishWith(f, 'river-first')).rejects.toMatchObject({
        code: 'PUZZLE_PUBLICATION_INVALID',
      });
    }
  });
});

test('a playtest or kept evidence from earlier rules no longer proves the draft', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await playTo(f, 'river-first', ['take1', 'take2']);
    await f.db.transaction((tx) =>
      validate(f.puzzleContents).run(
        { tx, env: f.env },
        {
          documentId: 'river',
          draftId: 'river-first',
          playtestAttemptId: 'river-first-test',
        }
      )
    );
    const changed: ContentFixture = {
      ...f,
      puzzleContents: createPuzzleContentCatalog([
        { id: 'pile', puzzleContent: provenPile(2) },
      ]),
    };
    await expect(
      publishWith(changed, 'river-first', 'river-first-test')
    ).rejects.toThrow('earlier rules');
    await expect(publishWith(changed, 'river-first')).rejects.toMatchObject({
      code: 'PUZZLE_PUBLICATION_INVALID',
    });
  });
});

test('another person cannot offer an author their playtest as evidence', async () => {
  await withProvenPile(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    await playTo(f, 'river-first', ['take1', 'take2']);
    await f.db.run(
      sql`UPDATE puzzle_content_attempts SET owner_id = ${'bob'} WHERE id = ${'river-first-test'}`
    );
    await expect(
      publishWith(f, 'river-first', 'river-first-test')
    ).rejects.toBeDefined();
    const published = await f.db.query(
      sql<{ id: string }>`SELECT id FROM puzzle_content_revisions`
    );
    expect(published).toEqual([]);
  });
});
