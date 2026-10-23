import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  createDraftFor,
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import type { ContentHarness } from './content-system';

export const arrangeKeptContentCopies = defineAction({
  name: 'arrangeKeptContentCopies',
  act: async (s: ContentHarness, first: string, second: string) => {
    await createDraftFor(s, 'alice:phone', { title: 'River', valid: false });
    const original = currentContentEditor(s, 'alice:phone');
    s.editors.set('alice:tablet', {
      ...original,
      body: { ...original.body, title: second },
    });
    original.body = { ...original.body, title: first };
    await saveContentEditor(s, 'alice:phone');
    await saveContentEditor(s, 'alice:tablet');
  },
});

export const chooseKeptContentDraft = defineAction({
  name: 'chooseKeptContentDraft',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const source = currentContentEditor(s, 'alice:phone');
    const library = await readContentLibrary(
      contentClient(s, 'alice:phone').db
    );
    const chosen = library.drafts.find(
      (draft) =>
        draft.document_id === source.documentId && draft.title === title
    );
    const doc = library.documents.find(
      (entry) => entry.id === source.documentId
    );
    if (chosen === undefined || doc === undefined)
      throw new Error('Open a kept draft before choosing it');
    const draftId = s.session.ports.createId();
    if (
      await sendContentMutation(s, clientId, 'choosePuzzleContentDraft', {
        documentId: doc.id,
        chosenDraftId: chosen.id,
        expectedDraftId: doc.working_draft_id,
        draftId,
      })
    )
      s.editors.set(clientId, {
        documentId: doc.id,
        parentId: draftId,
        body: contentBody(chosen),
      });
  },
});

export const DRAFT_CHOICE_ACTIONS = [
  arrangeKeptContentCopies,
  chooseKeptContentDraft,
] as const;
