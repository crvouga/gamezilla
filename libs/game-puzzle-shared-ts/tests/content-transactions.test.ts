import { expect, test } from 'bun:test';
import {
  readContentDocument,
  readContentDraft,
  readContentRevision,
} from '@libs/game-puzzle-shared-ts/content-store';
import { createPuzzleContentMutation as create } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { publishPuzzleContentMutation as publish } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { savePuzzleContentDraftMutation as save } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { withdrawPuzzleContentMutation as withdraw } from '@libs/game-puzzle-shared-ts/withdraw-content-mutation';
import { CONTENT_BODY, withContentFixture } from './content-fixture';

// regression: puzzle-content-create-id-reuse
test('a reused creation identity cannot discard a different initial draft', async () => {
  await withContentFixture(async ({ db, env }) => {
    await db.transaction((tx) =>
      create.run(
        { tx, env },
        {
          documentId: 'river',
          draftId: 'river-draft',
          gameId: 'pile',
          kind: 'puzzle',
          body: CONTENT_BODY,
        }
      )
    );
    await expect(
      db.transaction((tx) =>
        create.run(
          { tx, env },
          {
            documentId: 'river',
            draftId: 'other-draft',
            gameId: 'pile',
            kind: 'puzzle',
            body: { ...CONTENT_BODY, title: 'Valley' },
          }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_CONTENT_ID_REUSED' });
  });
});

// regression: puzzle-content-draft-boolean-decode
test('stale draft writes retain both bodies and do not replace the selected head', async () => {
  await withContentFixture(async ({ db, env }) => {
    await db.transaction((tx) =>
      create.run(
        { tx, env },
        {
          documentId: 'river',
          draftId: 'first',
          gameId: 'pile',
          kind: 'puzzle',
          body: CONTENT_BODY,
        }
      )
    );
    await db.transaction((tx) =>
      save.run(
        { tx, env },
        {
          documentId: 'river',
          parentId: 'first',
          draftId: 'phone',
          body: { ...CONTENT_BODY, title: 'Valley' },
        }
      )
    );
    await db.transaction((tx) =>
      save.run(
        { tx, env },
        {
          documentId: 'river',
          parentId: 'first',
          draftId: 'tablet',
          body: { ...CONTENT_BODY, title: 'Harbor' },
        }
      )
    );
    expect((await readContentDocument(db, 'river'))?.working_draft_id).toBe(
      'phone'
    );
    expect(await readContentDraft(db, 'phone')).toMatchObject({
      title: 'Valley',
      conflicted: false,
    });
    expect(await readContentDraft(db, 'tablet')).toMatchObject({
      title: 'Harbor',
      conflicted: true,
    });
  });
});

test('published bytes stay unchanged across saves, duplicate publication and withdrawal', async () => {
  await withContentFixture(async ({ db, env }) => {
    await db.transaction((tx) =>
      create.run(
        { tx, env },
        {
          documentId: 'river',
          draftId: 'first',
          gameId: 'pile',
          kind: 'puzzle',
          body: CONTENT_BODY,
        }
      )
    );
    await db.transaction((tx) =>
      publish.run({ tx, env }, { documentId: 'river', draftId: 'first' })
    );
    const original = await readContentRevision(db, 'first');
    await db.transaction((tx) =>
      save.run(
        { tx, env },
        {
          documentId: 'river',
          parentId: 'first',
          draftId: 'next',
          body: { ...CONTENT_BODY, title: 'Valley' },
        }
      )
    );
    await db.transaction((tx) =>
      publish.run({ tx, env }, { documentId: 'river', draftId: 'next' })
    );
    await db.transaction((tx) =>
      publish.run({ tx, env }, { documentId: 'river', draftId: 'first' })
    );
    expect(
      (await readContentDocument(db, 'river'))?.published_revision_id
    ).toBe('next');
    await db.transaction((tx) =>
      withdraw.run({ tx, env }, { documentId: 'river' })
    );
    await db.transaction((tx) =>
      publish.run({ tx, env }, { documentId: 'river', draftId: 'first' })
    );
    expect(await readContentDocument(db, 'river')).toMatchObject({
      status: 'withdrawn',
      publication_count: 2,
    });
    expect(await readContentRevision(db, 'first')).toEqual(original);
  });
});
