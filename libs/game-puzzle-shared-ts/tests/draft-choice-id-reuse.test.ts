import { expect, test } from 'bun:test';
import { choosePuzzleContentDraftMutation as choose } from '@libs/game-puzzle-shared-ts/choose-content-draft-mutation';
import { readContentDocument } from '@libs/game-puzzle-shared-ts/content-store';
import { savePuzzleContentDraftMutation as save } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import {
  CONTENT_BODY,
  createContentFixture,
  withContentFixture,
} from './content-fixture';

// regression: puzzle-kept-draft-id-reuse-overwrites-head
test('reusing a kept-copy identity with a different expected head cannot revisit it', async () => {
  await withContentFixture(async (f) => {
    await createContentFixture(f, { id: 'river', title: 'River' });
    for (const title of ['Valley', 'Harbor'])
      await f.db.transaction((tx) =>
        save.run(
          { tx, env: f.env },
          {
            documentId: 'river',
            parentId: 'river-first',
            draftId: title,
            body: { ...CONTENT_BODY, title },
          }
        )
      );
    const choice = {
      documentId: 'river',
      expectedDraftId: 'Valley',
      chosenDraftId: 'Harbor',
      draftId: 'chosen',
    };
    await f.db.transaction((tx) => choose.run({ tx, env: f.env }, choice));
    await f.db.transaction((tx) =>
      save.run(
        { tx, env: f.env },
        {
          documentId: 'river',
          parentId: 'chosen',
          draftId: 'evening',
          body: { ...CONTENT_BODY, title: 'Evening harbor' },
        }
      )
    );
    await expect(
      f.db.transaction((tx) =>
        choose.run(
          { tx, env: f.env },
          { ...choice, expectedDraftId: 'evening' }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_DRAFT_ID_REUSED' });
    expect((await readContentDocument(f.db, 'river'))?.working_draft_id).toBe(
      'evening'
    );
  });
});
