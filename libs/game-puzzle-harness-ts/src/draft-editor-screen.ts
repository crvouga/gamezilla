import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import {
  type ContentDraft,
  contentBody,
} from '@libs/game-puzzle-shared-ts/content-types';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient, currentContentEditor } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

export type DraftEditorView = Awaited<ReturnType<typeof mountContentExample>>;

/** What the author builder says once every change on this device is kept. */
const SAVED_STATUS = 'Saved on this device. Changes share when connected.';

export const UNDO_DRAFT_EDIT = 'content-undo-draft-edit';
export const REDO_DRAFT_EDIT = 'content-redo-draft-edit';

export async function workingDraftOn(
  s: ContentHarness,
  clientId: string,
  documentId: string
): Promise<ContentDraft | null> {
  return workingContentDraft(
    await readContentLibrary(contentClient(s, clientId).db),
    documentId
  );
}

/** The builder shows the device's working copy as current and has nothing left to save. */
function editorShows(view: DraftEditorView, draft: ContentDraft): boolean {
  const current = view.queryByTestId(`content-use-copy-${draft.id}`);
  return (
    current?.textContent.includes('Current') === true &&
    view.queryByTestId('content-draft-save-status')?.textContent ===
      SAVED_STATUS
  );
}

/**
 * Wait until the device keeps a working copy `accept` recognises and the
 * open builder edits that copy with nothing left to save.
 */
export async function waitForEditorAt(
  s: ContentHarness,
  editor: { readonly view: DraftEditorView; readonly clientId: string },
  documentId: string,
  accept: (draft: ContentDraft) => boolean
): Promise<void> {
  await waitForContent(s, async () => {
    const draft = await workingDraftOn(s, editor.clientId, documentId);
    return draft !== null && accept(draft) && editorShows(editor.view, draft);
  });
}

/** Open the draft this device is editing in the shared builder. */
export async function openDraftEditor(
  s: ContentHarness,
  clientId: string
): Promise<{ readonly view: DraftEditorView; readonly documentId: string }> {
  const documentId = currentContentEditor(s, clientId).documentId;
  const view = await mountContentExample(s, clientId);
  try {
    const entry = `content-draft-${documentId}`;
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(entry) !== null)
    );
    fireEvent.click(view.getByTestId(entry));
    await waitForEditorAt(s, { view, clientId }, documentId, () => true);
    return { view, documentId };
  } catch (failure) {
    view.unmount();
    throw failure;
  }
}

/** Continue harness edits from the copy the builder left as the working draft. */
export async function followWorkingDraft(
  s: ContentHarness,
  clientId: string,
  documentId: string
): Promise<void> {
  const draft = await workingDraftOn(s, clientId, documentId);
  if (draft === null) throw new Error('The builder lost its working copy');
  s.editors.set(clientId, {
    documentId,
    parentId: draft.id,
    body: contentBody(draft),
  });
}

/** Whether the builder offers a control, or `null` when it shows none. */
export function controlOffered(
  view: DraftEditorView,
  testId: string
): boolean | null {
  const control = view.queryByTestId(testId);
  return control === null ? null : !(control as HTMLButtonElement).disabled;
}
