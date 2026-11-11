import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient } from './content-actions';
import {
  type ContentScreenPlace,
  openContentPlace,
  openLibraryEntry,
  showContentHome,
} from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { waitForEditorAt, workingDraftOn } from './draft-editor-screen';
import { mountContentExample } from './mount-content-example';
import { movePackRowUp } from './pack-row-menu';

type View = Awaited<ReturnType<typeof mountContentExample>>;

/** A field of the builder's details screen, which must be the one shown. */
export function builderField(
  view: Pick<View, 'getByLabelText'>,
  label: 'Title' | 'Description' | 'Difficulty (optional)'
): HTMLElement {
  return view.getByLabelText(label);
}

/**
 * The builder's details screen (title, description, difficulty), opened
 * from its hub by its row, as a person does.
 */
export async function openBuilderDetails(
  s: ContentHarness,
  view: Pick<View, 'queryByTestId' | 'getByTestId' | 'queryByLabelText'>
): Promise<void> {
  await openContentPlace(contentWait(s), view, 'details');
  await waitForContent(s, () =>
    Promise.resolve(view.queryByLabelText('Title') !== null)
  );
}
/** One open builder per device: its undo and redo choices last while it is open. */
export type BuilderSession = {
  readonly documentId: string;
  readonly view: View;
};

const SAVED = 'Saved on this device. Changes share when connected.';

export function closeBuilder(s: ContentHarness, clientId: string): void {
  s.builders.get(clientId)?.view.unmount();
  s.builders.delete(clientId);
}

export function closeBuilders(s: ContentHarness): void {
  for (const clientId of [...s.builders.keys()]) closeBuilder(s, clientId);
}

/** The draft a device is building: its selected pack, else its puzzle. */
function buildingDocument(s: ContentHarness, clientId: string): string {
  const id = s.editors.get(clientId)?.documentId;
  if (id === undefined) throw new Error(`${clientId} is not building a draft`);
  return id;
}

export async function openBuilder(
  s: ContentHarness,
  clientId: string,
  documentId = buildingDocument(s, clientId)
): Promise<View> {
  const open = s.builders.get(clientId);
  if (open?.documentId === documentId) return open.view;
  closeBuilder(s, clientId);
  const view = await mountContentExample(s, clientId);
  await openLibraryEntry(contentWait(s), view, `content-draft-${documentId}`);
  await waitForContent(s, () =>
    Promise.resolve(view.queryByTestId('content-author') !== null)
  );
  s.builders.set(clientId, { documentId, view });
  return view;
}

/** Waits until the builder's last change is saved, then mirrors it as the device's editor. */
export async function settleBuilder(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const session = s.builders.get(clientId);
  if (session === undefined) throw new Error(`${clientId} has no open builder`);
  await waitForContent(s, () =>
    Promise.resolve(
      session.view.queryByTestId('content-draft-save-status')?.textContent ===
        SAVED
    )
  );
  const draft = workingContentDraft(
    await readContentLibrary(contentClient(s, clientId).db),
    session.documentId
  );
  if (draft === null) throw new Error('The builder lost its working draft');
  // People name a draft by its current title, as the fixtures do.
  s.documents.set(draft.title, session.documentId);
  const editor = s.editors.get(clientId);
  if (editor?.documentId === session.documentId)
    s.editors.set(clientId, {
      documentId: session.documentId,
      parentId: draft.id,
      body: contentBody(draft),
    });
}

/** Act on one of the open builder's small screens, then wait for the save. */
async function inBuilder(
  s: ContentHarness,
  clientId: string,
  place: ContentScreenPlace,
  act: (view: View) => void
): Promise<void> {
  const view = await openBuilder(s, clientId);
  await openContentPlace(contentWait(s), view, place);
  act(view);
  await settleBuilder(s, clientId);
}

export const editTitleInBuilder = defineAction({
  name: 'editTitleInBuilder',
  act: (s: ContentHarness, clientId: string, title: string) =>
    inBuilder(s, clientId, 'details', (view) => {
      fireEvent.input(builderField(view, 'Title'), {
        target: { value: title },
      });
    }),
});

/** The counting game's details: a target from one to nine, or none yet. */
export const editDetailsInBuilder = defineAction({
  name: 'editDetailsInBuilder',
  act: (s: ContentHarness, clientId: string, target: string) =>
    inBuilder(s, clientId, 'board', (view) => {
      fireEvent.input(view.getByLabelText('Target'), {
        target: { value: target },
      });
    }),
});

export const movePackPuzzleUpInBuilder = defineAction({
  name: 'movePackPuzzleUpInBuilder',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const packId = s.selectedPacks.get(clientId);
    const puzzleId = s.documents.get(title);
    if (packId === undefined || puzzleId === undefined)
      throw new Error(`No pack draft holds ${title}`);
    const view = await openBuilder(s, clientId, packId);
    await openContentPlace(contentWait(s), view, 'board');
    const item = `content-pack-item-${puzzleId}`;
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(item) !== null)
    );
    const row = view.getByTestId(item);
    movePackRowUp(view, row);
    await settleBuilder(s, clientId);
  },
});

function historyButton(view: View, testId: string): HTMLButtonElement {
  const button = view.getByTestId(testId);
  if (!(button instanceof HTMLButtonElement))
    throw new Error(`${testId} is not a button`);
  return button;
}

async function chooseHistory(
  s: ContentHarness,
  clientId: string,
  testId: string
): Promise<void> {
  const session = s.builders.get(clientId);
  const view = session?.view ?? (await openBuilder(s, clientId));
  // Undo and redo head the board they act on.
  await openContentPlace(contentWait(s), view, 'board');
  const documentId = buildingDocument(s, clientId);
  const before = await workingDraftOn(s, clientId, documentId);
  const button = historyButton(view, testId);
  if (button.disabled) throw new Error(`${testId} is not offered`);
  fireEvent.click(button);
  await waitForEditorAt(
    s,
    { view, clientId },
    documentId,
    (draft) => draft.id !== before?.id
  );
  await settleBuilder(s, clientId);
  // The shared control shows its success face before offering the next edit.
  const label = testId === 'content-undo-draft-edit' ? 'Undo' : 'Redo';
  await waitForContent(s, () => Promise.resolve(button.textContent === label));
}

export const undoDraftEditInBuilder = defineAction({
  name: 'undoDraftEditInBuilder',
  act: (s: ContentHarness, clientId: string) =>
    chooseHistory(s, clientId, 'content-undo-draft-edit'),
});

export const redoDraftEditInBuilder = defineAction({
  name: 'redoDraftEditInBuilder',
  act: (s: ContentHarness, clientId: string) =>
    chooseHistory(s, clientId, 'content-redo-draft-edit'),
});

/** Which editing choices the open builder offers; opening one offers fresh choices. */
export async function offeredDraftEdits(
  s: ContentHarness,
  clientId: string,
  documentId?: string
): Promise<{ readonly undo: boolean; readonly redo: boolean }> {
  const view =
    s.builders.get(clientId)?.view ??
    (await openBuilder(s, clientId, documentId));
  const wait = contentWait(s);
  await openContentPlace(wait, view, 'board');
  const offered = {
    undo: !historyButton(view, 'content-undo-draft-edit').disabled,
    redo: !historyButton(view, 'content-redo-draft-edit').disabled,
  };
  await showContentHome(wait, view, 'builder');
  return offered;
}

export const BUILDER_ACTIONS = [
  editTitleInBuilder,
  editDetailsInBuilder,
  movePackPuzzleUpInBuilder,
  undoDraftEditInBuilder,
  redoDraftEditInBuilder,
] as const;
