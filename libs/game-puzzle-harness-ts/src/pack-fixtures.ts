import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import {
  contentClient,
  createDraftFor,
  currentContentEditor,
  sendContentMutation,
} from './content-actions';
import { publishCurrentContent } from './content-publication-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';

export async function createPackFor(
  s: ContentHarness,
  args: {
    readonly title: string;
    readonly titles: readonly string[];
    readonly description?: string;
  }
): Promise<void> {
  const documentId = s.session.ports.createId();
  const draftId = s.session.ports.createId();
  const library = await readContentLibrary(contentClient(s, 'alice:phone').db);
  const body = {
    title: args.title,
    description: args.description ?? '',
    difficulty: '',
    definition: JSON.stringify({
      items: args.titles.map((title) => {
        const doc = library.documents.find(
          (entry) => entry.id === s.documents.get(title)
        );
        if (doc === undefined)
          throw new Error(`Missing fixture puzzle ${title}`);
        return { puzzleId: doc.id, revisionId: doc.published_revision_id };
      }),
    }),
  };
  const accepted = await sendContentMutation(
    s,
    'alice:phone',
    'createPuzzleContent',
    {
      documentId,
      draftId,
      gameId: 'counting',
      kind: 'pack',
      body,
    }
  );
  if (!accepted) throw new Error('The fixture pack could not be created');
  s.documents.set(args.title, documentId);
  s.selectedPacks.set('alice:phone', documentId);
  s.editors.set('alice:phone', { documentId, parentId: draftId, body });
}

export async function arrangePublishedPuzzle(
  s: ContentHarness,
  title: string
): Promise<void> {
  if (s.documents.has(title)) return;
  await createDraftFor(s, 'alice:phone', { title, valid: true });
  const editor = currentContentEditor(s, 'alice:phone');
  s.publishedDrafts.set(title, {
    documentId: editor.documentId,
    draftId: editor.parentId,
  });
  await publishCurrentContent(s, 'alice:phone');
  if (s.lastResult.get('alice:phone')?.ok !== true)
    throw new Error('The fixture puzzle could not be published');
  await waitForContent(s, async () =>
    (await readContentLibrary(contentClient(s, 'bob:phone').db)).revisions.some(
      (revision) => revision.id === editor.parentId
    )
  );
}

export async function arrangePackFor(
  s: ContentHarness,
  args: {
    readonly title: string;
    readonly titles: readonly string[];
    readonly published?: boolean;
  }
): Promise<void> {
  for (const title of args.titles) await arrangePublishedPuzzle(s, title);
  await createPackFor(s, args);
  if (args.published) {
    await publishCurrentContent(s, 'alice:phone');
    if (s.lastResult.get('alice:phone')?.ok !== true)
      throw new Error('The fixture pack could not be published');
    const packId = s.selectedPacks.get('alice:phone');
    await waitForContent(s, async () =>
      (
        await readContentLibrary(contentClient(s, 'bob:phone').db)
      ).revisions.some((revision) => revision.document_id === packId)
    );
  }
}
