import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  createDraftFor,
  currentContentEditor,
  sendContentMutation,
} from './content-actions';
import type { ContentHarness } from './content-system';

const devices: Readonly<Record<string, string>> = {
  Alice: 'alice:phone',
  Bob: 'bob:phone',
};

function deviceOf(person: string): string {
  const device = devices[person];
  if (device === undefined)
    throw new Error(`Unknown publication actor: ${person}`);
  return device;
}

export function lifecycleDraft(s: ContentHarness, index: number): string {
  const id = s.lifecycleDrafts[index];
  if (id === undefined) throw new Error(`Unknown saved draft choice: ${index}`);
  return id;
}

export const setupPuzzlePublication = defineAction({
  name: 'setupPuzzlePublication',
  act: async (s: ContentHarness) => {
    await createDraftFor(s, 'alice:phone', { title: 'River', valid: true });
    s.lifecycleDrafts.push(currentContentEditor(s, 'alice:phone').parentId);
  },
});

export const savePublicationDraft = defineAction({
  name: 'savePublicationDraft',
  act: async (
    s: ContentHarness,
    person: string,
    title: string,
    valid: boolean
  ) => {
    const source = currentContentEditor(s, 'alice:phone');
    const body = {
      ...source.body,
      title,
      definition: valid ? 'target:2' : 'target:',
    };
    const draftId = s.session.ports.createId();
    if (
      await sendContentMutation(s, deviceOf(person), 'savePuzzleContentDraft', {
        documentId: source.documentId,
        parentId: source.parentId,
        draftId,
        body,
      })
    ) {
      s.lifecycleDrafts.push(draftId);
      s.editors.set('alice:phone', { ...source, parentId: draftId, body });
    }
  },
});

export const choosePublicationDraft = defineAction({
  name: 'choosePublicationDraft',
  act: async (s: ContentHarness, person: string, index: number) => {
    const source = currentContentEditor(s, 'alice:phone');
    const library = await readContentLibrary(
      contentClient(s, 'alice:phone').db
    );
    const chosen = library.drafts.find(
      (draft) => draft.id === lifecycleDraft(s, index)
    );
    if (chosen === undefined) throw new Error('The saved draft is unavailable');
    const draftId = s.session.ports.createId();
    if (
      await sendContentMutation(
        s,
        deviceOf(person),
        'choosePuzzleContentDraft',
        {
          documentId: source.documentId,
          chosenDraftId: chosen.id,
          expectedDraftId: source.parentId,
          draftId,
        }
      )
    ) {
      s.lifecycleDrafts.push(draftId);
      s.editors.set('alice:phone', {
        documentId: source.documentId,
        parentId: draftId,
        body: contentBody(chosen),
      });
    }
  },
});

export const publishSavedContentDraft = defineAction({
  name: 'publishSavedContentDraft',
  act: async (s: ContentHarness, person: string, index: number) => {
    await sendContentMutation(s, deviceOf(person), 'publishPuzzleContent', {
      documentId: currentContentEditor(s, 'alice:phone').documentId,
      draftId: lifecycleDraft(s, index),
    });
  },
});

export const withdrawPublication = defineAction({
  name: 'withdrawPublication',
  act: async (s: ContentHarness, person: string) => {
    await sendContentMutation(s, deviceOf(person), 'withdrawPuzzleContent', {
      documentId: currentContentEditor(s, 'alice:phone').documentId,
    });
  },
});

export const PUBLICATION_LIFECYCLE_ACTIONS = [
  setupPuzzlePublication,
  savePublicationDraft,
  choosePublicationDraft,
  publishSavedContentDraft,
  withdrawPublication,
] as const;
