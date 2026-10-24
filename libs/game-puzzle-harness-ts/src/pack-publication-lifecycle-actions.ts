import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  createDraftFor,
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import { publishCurrentContent } from './content-publication-actions';
import { selectContentDocument, selectPackEditor } from './content-selection';
import type { ContentHarness } from './content-system';
import { createPackFor } from './pack-fixtures';

export function lifecyclePuzzle(s: ContentHarness, index: number): string {
  const id = s.lifecyclePuzzles[index];
  if (id === undefined) throw new Error(`Unknown pack puzzle choice: ${index}`);
  return id;
}

export const setupPackPublication = defineAction({
  name: 'setupPackPublication',
  act: async (s: ContentHarness) => {
    await createDraftFor(s, 'alice:phone', { title: 'River', valid: true });
    s.lifecyclePuzzles.push(currentContentEditor(s, 'alice:phone').documentId);
    await publishCurrentContent(s, 'alice:phone');
    await createDraftFor(s, 'alice:phone', { title: 'Valley', valid: true });
    s.lifecyclePuzzles.push(currentContentEditor(s, 'alice:phone').documentId);
    await createPackFor(s, { title: 'Rivers', titles: ['River', 'Valley'] });
    s.lifecycleDrafts.push(currentContentEditor(s, 'alice:phone').parentId);
  },
});

export const savePackPublicationDraft = defineAction({
  name: 'savePackPublicationDraft',
  act: async (s: ContentHarness, order: readonly number[]) => {
    await selectPackEditor(s, 'alice:phone');
    const editor = currentContentEditor(s, 'alice:phone');
    const chosen = decodePackDefinition(editor.body.definition);
    if (chosen === null) throw new Error('Open a readable pack draft');
    const library = await readContentLibrary(
      contentClient(s, 'alice:phone').db
    );
    const items = order.map((index) => {
      const puzzleId = lifecyclePuzzle(s, index);
      const kept = chosen.items.find((item) => item.puzzleId === puzzleId);
      const latest = library.revisions
        .filter((edition) => edition.document_id === puzzleId)
        .toSorted((a, b) => b.edition - a.edition)[0];
      return kept ?? { puzzleId, revisionId: latest?.id ?? null };
    });
    editor.body = { ...editor.body, definition: JSON.stringify({ items }) };
    await saveContentEditor(s, 'alice:phone');
    if (s.lastResult.get('alice:phone')?.ok === true)
      s.lifecycleDrafts.push(currentContentEditor(s, 'alice:phone').parentId);
  },
});

export const publishPackPuzzleEdition = defineAction({
  name: 'publishPackPuzzleEdition',
  act: async (s: ContentHarness, index: number) => {
    await selectContentDocument(s, 'alice:phone', lifecyclePuzzle(s, index));
    const editor = currentContentEditor(s, 'alice:phone');
    const library = await readContentLibrary(
      contentClient(s, 'alice:phone').db
    );
    if (library.revisions.some((edition) => edition.id === editor.parentId))
      await saveContentEditor(s, 'alice:phone');
    await publishCurrentContent(s, 'alice:phone');
    await selectPackEditor(s, 'alice:phone');
  },
});

export const withdrawPackPuzzleEdition = defineAction({
  name: 'withdrawPackPuzzleEdition',
  act: async (s: ContentHarness, index: number) => {
    await sendContentMutation(s, 'alice:phone', 'withdrawPuzzleContent', {
      documentId: lifecyclePuzzle(s, index),
    });
  },
});

export const PACK_PUBLICATION_LIFECYCLE_ACTIONS = [
  setupPackPublication,
  savePackPublicationDraft,
  publishPackPuzzleEdition,
  withdrawPackPuzzleEdition,
] as const;
