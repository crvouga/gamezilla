import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { editTitleInBuilder } from './builder-session';
import {
  contentClient,
  createDraftFor,
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import { selectPuzzleEditor } from './content-selection';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';

export async function publishCurrentContent(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const editor = currentContentEditor(s, clientId);
  await sendContentMutation(s, clientId, 'publishPuzzleContent', {
    documentId: editor.documentId,
    draftId: editor.parentId,
  });
}

export const publishContentDraft = defineAction({
  name: 'publishContentDraft',
  act: async (s: ContentHarness, clientId: string) => {
    await selectPuzzleEditor(s, clientId);
    await publishCurrentContent(s, clientId);
  },
});

export const arrangePublishedContent = defineAction({
  name: 'arrangePublishedContent',
  act: async (s: ContentHarness, title: string) => {
    await createDraftFor(s, 'alice:phone', { title, valid: true });
    const editor = currentContentEditor(s, 'alice:phone');
    s.publishedDrafts.set(title, {
      documentId: editor.documentId,
      draftId: editor.parentId,
    });
    await publishCurrentContent(s, 'alice:phone');
    if (s.lastResult.get('alice:phone')?.ok !== true)
      throw new Error(
        `The fixture publication failed: ${JSON.stringify(s.lastResult.get('alice:phone'))}`
      );
    await waitForContent(s, async () =>
      (
        await readContentLibrary(contentClient(s, 'bob:phone').db)
      ).revisions.some((revision) => revision.id === editor.parentId)
    );
  },
});

export const reviseContentDraft = defineAction({
  name: 'reviseContentDraft',
  act: async (s: ContentHarness, title: string) => {
    // A person already in the builder renames there, so its choices follow.
    if (s.builders.has('alice:phone'))
      return editTitleInBuilder.act(s, 'alice:phone', title);
    await selectPuzzleEditor(s, 'alice:phone');
    const editor = currentContentEditor(s, 'alice:phone');
    editor.body = { ...editor.body, title };
    await saveContentEditor(s, 'alice:phone');
  },
});

export const publishEarlierContent = defineAction({
  name: 'publishEarlierContent',
  act: async (s: ContentHarness, title: string) => {
    const draft = s.publishedDrafts.get(title);
    if (draft === undefined)
      throw new Error(`No earlier fixture edition: ${title}`);
    await sendContentMutation(s, 'alice:phone', 'publishPuzzleContent', draft);
  },
});

export const publishOtherContentDraft = defineAction({
  name: 'publishOtherContentDraft',
  act: async (s: ContentHarness) => {
    const source = currentContentEditor(s, 'alice:phone');
    await sendContentMutation(s, 'bob:phone', 'publishPuzzleContent', {
      documentId: source.documentId,
      draftId: source.parentId,
    });
  },
});

export const withdrawContent = defineAction({
  name: 'withdrawContent',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const documentId = s.documents.get(title);
    if (documentId === undefined)
      throw new Error(`Unknown fixture puzzle: ${title}`);
    await sendContentMutation(s, clientId, 'withdrawPuzzleContent', {
      documentId,
    });
  },
});

export const validateContent = defineAction({
  name: 'validateContent',
  act: async (s: ContentHarness) => {
    const editor = currentContentEditor(s, 'alice:phone');
    await sendContentMutation(s, 'alice:phone', 'validatePuzzleContentDraft', {
      documentId: editor.documentId,
      draftId: editor.parentId,
    });
  },
});

export const PUBLICATION_ACTIONS = [
  publishContentDraft,
  arrangePublishedContent,
  reviseContentDraft,
  publishEarlierContent,
  publishOtherContentDraft,
  withdrawContent,
  validateContent,
] as const;
