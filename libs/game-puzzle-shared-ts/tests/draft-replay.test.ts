import { expect, test } from 'bun:test';
import {
  readContentDocument,
  readContentDraft,
} from '@libs/game-puzzle-shared-ts/content-store';
import { savePuzzleContentDraftMutation as save } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  CONTENT_BODY,
  createContentFixture,
  withContentFixture,
} from './content-fixture';

// regression: puzzle-pending-draft-rebase-loses-head
test('a pending draft restores its head after an earlier snapshot while an older replay cannot undo later editing', async () => {
  await withContentFixture(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    const args = {
      documentId: 'river',
      draftId: 'valley',
      parentId: 'river-first',
      body: { ...CONTENT_BODY, title: 'Valley' },
    };
    const replay = () =>
      f.db.transaction((tx) => save.run({ tx, env: f.env }, args));
    await replay();
    const saved = await readContentDraft(f.db, 'valley');
    await f.db.run(
      sql`UPDATE puzzle_content_documents SET working_draft_id = ${'river-first'} WHERE id = ${'river'}`
    );
    await replay();
    expect((await readContentDocument(f.db, 'river'))?.working_draft_id).toBe(
      'valley'
    );
    expect(await readContentDraft(f.db, 'valley')).toEqual(saved);
    await f.db.transaction((tx) =>
      save.run(
        { tx, env: f.env },
        {
          ...args,
          draftId: 'evening',
          parentId: 'valley',
          body: { ...CONTENT_BODY, title: 'Evening' },
        }
      )
    );
    await replay();
    expect((await readContentDocument(f.db, 'river'))?.working_draft_id).toBe(
      'evening'
    );
  });
});
