import {
  type ContentLibrary,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient, createDraftFor } from './content-actions';
import type { ContentHarness } from './content-system';
import {
  controlOffered,
  type DraftEditorView,
  followWorkingDraft,
  openDraftEditor,
  REDO_DRAFT_EDIT,
  UNDO_DRAFT_EDIT,
  waitForEditorAt,
  workingDraftOn,
} from './draft-editor-screen';
import { arrangePackFor } from './pack-fixtures';

type Editing = {
  readonly s: ContentHarness;
  readonly clientId: string;
  readonly view: DraftEditorView;
  readonly documentId: string;
};

/** Open the builder, do `work` in it, then continue from the copy it kept. */
async function inDraftEditor(
  s: ContentHarness,
  clientId: string,
  work: (editing: Editing) => Promise<void>
): Promise<void> {
  const { view, documentId } = await openDraftEditor(s, clientId);
  try {
    await work({ s, clientId, view, documentId });
  } finally {
    view.unmount();
  }
  await followWorkingDraft(s, clientId, documentId);
}

function settle(
  editing: Editing,
  accept: Parameters<typeof waitForEditorAt>[3]
): Promise<void> {
  return waitForEditorAt(editing.s, editing, editing.documentId, accept);
}

async function typeTitle(editing: Editing, title: string): Promise<void> {
  fireEvent.input(editing.view.getByLabelText('Title'), {
    target: { value: title },
  });
  await settle(editing, (draft) => draft.title === title);
}

async function typeDetails(editing: Editing, valid: boolean): Promise<void> {
  const definition = valid ? 'target:2' : 'target:';
  fireEvent.input(editing.view.getByLabelText('Target'), {
    target: { value: definition.slice(7) },
  });
  await settle(editing, (draft) => draft.definition === definition);
}

function packItemTitle(library: ContentLibrary, puzzleId: string): string {
  return workingContentDraft(library, puzzleId)?.title ?? '';
}

/** The pack's puzzles in their working order, by title, with their ids. */
async function packOrder(
  editing: Editing
): Promise<readonly { readonly id: string; readonly title: string }[]> {
  const library = await readContentLibrary(
    contentClient(editing.s, editing.clientId).db
  );
  const draft = workingContentDraft(library, editing.documentId);
  return (decodePackDefinition(draft?.definition ?? '')?.items ?? []).map(
    (item) => ({
      id: item.puzzleId,
      title: packItemTitle(library, item.puzzleId),
    })
  );
}

/** Press "move up" on the pack row titled `title` and wait for the kept copy. */
async function moveUp(editing: Editing, title: string): Promise<void> {
  const order = await packOrder(editing);
  const index = order.findIndex((item) => item.title === title);
  const item = order[index];
  if (item === undefined || index === 0)
    throw new Error(`The pack offers no way to move ${title} up`);
  const row = editing.view.getByTestId(`content-pack-item-${item.id}`);
  const up = row.querySelector<HTMLButtonElement>(
    '[data-testid="content-pack-up"]'
  );
  if (up === null) throw new Error(`The row ${title} offers no move up`);
  fireEvent.click(up);
  const expected = order.map((entry) => entry.id);
  expected.splice(index - 1, 2, item.id, order[index - 1]?.id ?? '');
  await settle(
    editing,
    (draft) =>
      JSON.stringify(
        decodePackDefinition(draft.definition)?.items.map((x) => x.puzzleId)
      ) === JSON.stringify(expected)
  );
}

async function arrangeOrder(
  editing: Editing,
  titles: readonly string[]
): Promise<void> {
  for (const [index, title] of titles.entries())
    while (
      (await packOrder(editing)).findIndex((item) => item.title === title) >
      index
    )
      await moveUp(editing, title);
}

export const editDraftTitleThroughScreen = defineAction({
  name: 'editDraftTitleThroughScreen',
  act: (s: ContentHarness, clientId: string, title: string) =>
    inDraftEditor(s, clientId, (editing) => typeTitle(editing, title)),
});

export const saveDraftDetailsThroughScreen = defineAction({
  name: 'saveDraftDetailsThroughScreen',
  act: (s: ContentHarness, clientId: string, valid: boolean) =>
    inDraftEditor(s, clientId, (editing) => typeDetails(editing, valid)),
});

export const movePackPuzzleThroughScreen = defineAction({
  name: 'movePackPuzzleThroughScreen',
  act: (s: ContentHarness, clientId: string, title: string, before: string) =>
    inDraftEditor(s, clientId, async (editing) => {
      const at = async (name: string) =>
        (await packOrder(editing)).findIndex((item) => item.title === name);
      while ((await at(title)) > (await at(before)))
        await moveUp(editing, title);
    }),
});

/** Bring the open draft to these details through the builder, one control at a time. */
export const saveEditingDraftThroughScreen = defineAction({
  name: 'saveEditingDraftThroughScreen',
  act: (
    s: ContentHarness,
    clientId: string,
    target: {
      readonly title: string;
      readonly valid: boolean;
      readonly contents: readonly string[];
    }
  ) =>
    inDraftEditor(s, clientId, async (editing) => {
      await typeTitle(editing, target.title);
      const library = await readContentLibrary(contentClient(s, clientId).db);
      const kind = library.documents.find(
        (doc) => doc.id === editing.documentId
      )?.kind;
      if (kind === 'pack') await arrangeOrder(editing, target.contents);
      else await typeDetails(editing, target.valid);
    }),
});

async function pressHistory(editing: Editing, testId: string): Promise<void> {
  const before = await workingDraftOn(
    editing.s,
    editing.clientId,
    editing.documentId
  );
  if (controlOffered(editing.view, testId) !== true)
    throw new Error(`The builder does not offer ${testId}`);
  fireEvent.click(editing.view.getByTestId(testId));
  await settle(editing, (draft) => draft.id !== before?.id);
}

export const undoDraftEditThroughScreen = defineAction({
  name: 'undoDraftEditThroughScreen',
  act: (s: ContentHarness, clientId: string) =>
    inDraftEditor(s, clientId, (editing) =>
      pressHistory(editing, UNDO_DRAFT_EDIT)
    ),
});

export const redoDraftEditThroughScreen = defineAction({
  name: 'redoDraftEditThroughScreen',
  act: (s: ContentHarness, clientId: string) =>
    inDraftEditor(s, clientId, (editing) =>
      pressHistory(editing, REDO_DRAFT_EDIT)
    ),
});

/** Alice owns the puzzle or pack draft "River" on her phone. */
export const setupDraftEditing = defineAction({
  name: 'setupDraftEditing',
  act: async (s: ContentHarness, kind: 'puzzle' | 'pack') => {
    s.games.set('alice:phone', 'counting');
    if (kind === 'pack')
      await arrangePackFor(s, { title: 'River', titles: ['River', 'Valley'] });
    else
      await createDraftFor(s, 'alice:phone', { title: 'River', valid: false });
  },
});

export const DRAFT_HISTORY_ACTIONS = [
  editDraftTitleThroughScreen,
  saveDraftDetailsThroughScreen,
  movePackPuzzleThroughScreen,
  saveEditingDraftThroughScreen,
  undoDraftEditThroughScreen,
  redoDraftEditThroughScreen,
  setupDraftEditing,
] as const;
