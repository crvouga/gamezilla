import { expect, test } from 'bun:test';
import { choosePuzzleContentDraftMutation as choose } from '@libs/game-puzzle-shared-ts/choose-content-draft-mutation';
import {
  readContentDocument,
  readContentDraft,
  readContentRevision,
} from '@libs/game-puzzle-shared-ts/content-store';
import { savePuzzleContentDraftMutation as save } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  CONTENT_BODY,
  type ContentFixture,
  createContentFixture,
  publishContentFixture,
  withContentFixture,
} from './content-fixture';

async function branches(f: ContentFixture): Promise<void> {
  await createContentFixture(f, { id: 'river', title: 'River' });
  await publishContentFixture(f, 'river');
  for (const [id, title] of [
    ['phone', 'Valley'],
    ['tablet', 'Harbor'],
  ] as const)
    await f.db.transaction((tx) =>
      save.run(
        { tx, env: f.env },
        {
          documentId: 'river',
          parentId: 'river-first',
          draftId: id,
          body: { ...CONTENT_BODY, title },
        }
      )
    );
}

const CHOICE = {
  documentId: 'river',
  chosenDraftId: 'tablet',
  expectedDraftId: 'phone',
  draftId: 'chosen-harbor',
};

// regression: puzzle-pending-draft-rebase-loses-head
test('a pending kept-copy choice restores its head after an earlier snapshot', async () => {
  await withContentFixture(async (f) => {
    await branches(f);
    await f.db.transaction((tx) => choose.run({ tx, env: f.env }, CHOICE));
    const chosen = await readContentDraft(f.db, CHOICE.draftId);
    await f.db.run(
      sql`UPDATE puzzle_content_documents SET working_draft_id = ${'phone'} WHERE id = ${'river'}`
    );
    await f.db.transaction((tx) => choose.run({ tx, env: f.env }, CHOICE));
    expect((await readContentDocument(f.db, 'river'))?.working_draft_id).toBe(
      CHOICE.draftId
    );
    expect(await readContentDraft(f.db, CHOICE.draftId)).toEqual(chosen);
  });
});

test('a kept branch becomes a new head without changing either source or the published edition', async () => {
  await withContentFixture(async (f) => {
    await branches(f);
    const phone = await readContentDraft(f.db, 'phone');
    const tablet = await readContentDraft(f.db, 'tablet');
    const edition = await readContentRevision(f.db, 'river-first');
    await f.db.transaction((tx) => choose.run({ tx, env: f.env }, CHOICE));
    expect(await readContentDraft(f.db, CHOICE.draftId)).toMatchObject({
      title: 'Harbor',
      parent_id: 'phone',
      conflicted: false,
    });
    expect(await readContentDocument(f.db, 'river')).toMatchObject({
      working_draft_id: CHOICE.draftId,
      published_revision_id: 'river-first',
    });
    expect(await readContentDraft(f.db, 'phone')).toEqual(phone);
    expect(await readContentDraft(f.db, 'tablet')).toEqual(tablet);
    expect(await readContentRevision(f.db, 'river-first')).toEqual(edition);
  });
});

test('a repeated earlier choice cannot move the head back after later editing', async () => {
  await withContentFixture(async (f) => {
    await branches(f);
    await f.db.transaction((tx) => choose.run({ tx, env: f.env }, CHOICE));
    await f.db.transaction((tx) =>
      save.run(
        { tx, env: f.env },
        {
          documentId: 'river',
          parentId: CHOICE.draftId,
          draftId: 'evening',
          body: { ...CONTENT_BODY, title: 'Evening harbor' },
        }
      )
    );
    await f.db.transaction((tx) => choose.run({ tx, env: f.env }, CHOICE));
    expect((await readContentDocument(f.db, 'river'))?.working_draft_id).toBe(
      'evening'
    );
  });
});

test('stale selection and a reused copy identity cannot change the head or add a copy', async () => {
  await withContentFixture(async (f) => {
    await branches(f);
    await expect(
      f.db.transaction((tx) =>
        choose.run(
          { tx, env: f.env },
          { ...CHOICE, expectedDraftId: 'river-first' }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_DRAFT_CHANGED' });
    expect(await readContentDraft(f.db, CHOICE.draftId)).toBeNull();
    await expect(
      f.db.transaction((tx) =>
        choose.run({ tx, env: f.env }, { ...CHOICE, draftId: 'tablet' })
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_DRAFT_ID_REUSED' });
    expect((await readContentDocument(f.db, 'river'))?.working_draft_id).toBe(
      'phone'
    );
  });
});
