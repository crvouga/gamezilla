import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import type { PackEdit } from '@libs/game-puzzle-shared-ts/pack-edit';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  currentContentEditor,
  sendContentMutation,
} from './content-actions';
import { publishCurrentContent } from './content-publication-actions';
import { selectPackEditor } from './content-selection';
import type { ContentHarness } from './content-system';
import {
  arrangePackFor,
  arrangePublishedPuzzle,
  createPackFor,
} from './pack-fixtures';

export const createPackDraft = defineAction({
  name: 'createPackDraft',
  act: createPackFor,
});
export const arrangePackDraft = defineAction({
  name: 'arrangePackDraft',
  act: arrangePackFor,
});
export const arrangePackPuzzle = defineAction({
  name: 'arrangePackPuzzle',
  act: arrangePublishedPuzzle,
});
export async function editPackFor(
  s: ContentHarness,
  clientId: string,
  edit: PackEdit
): Promise<void> {
  await selectPackEditor(s, clientId);
  const editor = currentContentEditor(s, clientId);
  const draftId = s.session.ports.createId();
  if (
    await sendContentMutation(s, clientId, 'editPuzzlePack', {
      documentId: editor.documentId,
      parentId: editor.parentId,
      draftId,
      edit,
    })
  ) {
    const library = await readContentLibrary(contentClient(s, clientId).db);
    const draft = library.drafts.find((entry) => entry.id === draftId);
    if (draft === undefined) throw new Error('A saved pack copy is missing');
    s.editors.set(clientId, {
      documentId: editor.documentId,
      parentId: draftId,
      body: contentBody(draft),
    });
  }
}

export const editPackDraft = defineAction({
  name: 'editPackDraft',
  act: editPackFor,
});

export const createPuzzleInPack = defineAction({
  name: 'createPuzzleInPack',
  act: async (s: ContentHarness, title: string) => {
    await selectPackEditor(s, 'alice:phone');
    const editor = currentContentEditor(s, 'alice:phone');
    const puzzleId = s.session.ports.createId();
    const puzzleDraftId = s.session.ports.createId();
    const packDraftId = s.session.ports.createId();
    const body = {
      title,
      description: '',
      difficulty: '',
      definition: 'target:',
    };
    if (
      await sendContentMutation(s, 'alice:phone', 'createPuzzleFromPack', {
        packId: editor.documentId,
        parentId: editor.parentId,
        packDraftId,
        puzzleId,
        puzzleDraftId,
        body,
      })
    ) {
      s.documents.set(title, puzzleId);
      s.selectedPuzzles.set('alice:phone', puzzleId);
      s.editors.set('alice:phone', {
        documentId: puzzleId,
        parentId: puzzleDraftId,
        body,
      });
    }
  },
});

export const publishPackDraft = defineAction({
  name: 'publishPackDraft',
  act: async (s: ContentHarness) => {
    await selectPackEditor(s, 'alice:phone');
    await publishCurrentContent(s, 'alice:phone');
  },
});

export const PACK_ACTIONS = [
  createPackDraft,
  arrangePackDraft,
  arrangePackPuzzle,
  editPackDraft,
  createPuzzleInPack,
  publishPackDraft,
] as const;
