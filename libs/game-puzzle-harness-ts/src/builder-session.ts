import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { waitForEditorAt, workingDraftOn } from './draft-editor-screen';
import { mountContentExample } from './mount-content-example';

type View = Awaited<ReturnType<typeof mountContentExample>>;
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
  const entry = `content-draft-${documentId}`;
  await waitForContent(s, () =>
    Promise.resolve(view.queryByTestId(entry) !== null)
  );
  fireEvent.click(view.getByTestId(entry));
  await waitForContent(s, () =>
    Promise.resolve(view.queryByLabelText('Title') !== null)
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

async function inBuilder(
  s: ContentHarness,
  clientId: string,
  act: (view: View) => void
): Promise<void> {
  act(await openBuilder(s, clientId));
  await settleBuilder(s, clientId);
}

export const editTitleInBuilder = defineAction({
  name: 'editTitleInBuilder',
  act: (s: ContentHarness, clientId: string, title: string) =>
    inBuilder(s, clientId, (view) => {
      fireEvent.input(view.getByLabelText('Title'), {
        target: { value: title },
      });
    }),
});

/** The counting game's details: a target from one to nine, or none yet. */
export const editDetailsInBuilder = defineAction({
  name: 'editDetailsInBuilder',
  act: (s: ContentHarness, clientId: string, target: string) =>
    inBuilder(s, clientId, (view) => {
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
    const item = `content-pack-item-${puzzleId}`;
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(item) !== null)
    );
    const row = view.getByTestId(item);
    const up = row.querySelector('[data-testid="content-pack-up"]');
    if (up === null) throw new Error(`${title} cannot move earlier`);
    fireEvent.click(up);
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
  const label =
    testId === 'content-undo-draft-edit' ? 'Undo edit' : 'Redo edit';
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
  return {
    undo: !historyButton(view, 'content-undo-draft-edit').disabled,
    redo: !historyButton(view, 'content-redo-draft-edit').disabled,
  };
}

export const BUILDER_ACTIONS = [
  editTitleInBuilder,
  editDetailsInBuilder,
  movePackPuzzleUpInBuilder,
  undoDraftEditInBuilder,
  redoDraftEditInBuilder,
] as const;
