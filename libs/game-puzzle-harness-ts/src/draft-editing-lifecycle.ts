import {
  type ContentLibrary,
  contentDraftCopies,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import type { ContentDraft } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import {
  editDetailsInBuilder,
  editTitleInBuilder,
  offeredDraftEdits,
  openBuilder,
  settleBuilder,
} from './builder-session';
import { contentClient, createDraftFor } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { examplePuzzleContent } from './example-app-rules';
import { arrangePublishedPuzzle, createPackFor } from './pack-fixtures';

const ALICE = 'alice:phone';

/** The draft-editing model's view of one kept draft. */
export type EditingDraft = {
  readonly kind: 'puzzle' | 'pack';
  readonly title: string;
  readonly valid: boolean;
  readonly contents: readonly string[];
};

function editingDocument(s: ContentHarness): string {
  const id = s.selectedPacks.get(ALICE) ?? s.editors.get(ALICE)?.documentId;
  if (id === undefined) throw new Error('Alice is not editing a draft');
  return id;
}

export const setupDraftEditing = defineAction({
  name: 'setupDraftEditing',
  act: async (s: ContentHarness, kind: 'puzzle' | 'pack') => {
    s.games.set(ALICE, 'counting');
    if (kind === 'puzzle')
      await createDraftFor(s, ALICE, { title: 'River', valid: false });
    else {
      for (const title of ['River', 'Valley'])
        await arrangePublishedPuzzle(s, title);
      await createPackFor(s, { title: 'River', titles: ['River', 'Valley'] });
    }
    const editor = s.editors.get(ALICE);
    if (editor !== undefined)
      s.editors.set('alice:tablet', { ...editor, body: { ...editor.body } });
    const packId = s.selectedPacks.get(ALICE);
    if (packId !== undefined) s.selectedPacks.set('alice:tablet', packId);
    await openBuilder(s, ALICE, editingDocument(s));
  },
});

/** A two-puzzle pack has one other order: the second puzzle moves first. */
async function swapPackInBuilder(s: ContentHarness): Promise<void> {
  const documentId = editingDocument(s);
  const view = await openBuilder(s, ALICE, documentId);
  const library = await readContentLibrary(contentClient(s, ALICE).db);
  const draft = workingContentDraft(library, documentId);
  const second = decodePackDefinition(draft?.definition ?? '')?.items[1];
  if (second === undefined) throw new Error('The pack has no second puzzle');
  const item = `content-pack-item-${second.puzzleId}`;
  await waitForContent(s, () =>
    Promise.resolve(view.queryByTestId(item) !== null)
  );
  const up = view
    .getByTestId(item)
    .querySelector('[data-testid="content-pack-up"]');
  if (up === null) throw new Error('The second puzzle cannot move first');
  fireEvent.click(up);
  await settleBuilder(s, ALICE);
}

export const saveEditingDraft = defineAction({
  name: 'saveEditingDraft',
  act: async (s: ContentHarness, saved: EditingDraft) => {
    const current = await editingDraftView(s, ALICE);
    if (current !== null && saved.title !== current.title)
      return editTitleInBuilder.act(s, ALICE, saved.title);
    if (current !== null && saved.valid !== current.valid)
      return editDetailsInBuilder.act(s, ALICE, saved.valid ? '2' : '');
    if (
      current !== null &&
      saved.contents.join(', ') !== current.contents.join(', ')
    )
      return swapPackInBuilder(s);
    // Saving unchanged work: the builder keeps the same body.
    return editTitleInBuilder.act(s, ALICE, saved.title);
  },
});

function viewOf(
  library: ContentLibrary,
  draft: ContentDraft | null
): EditingDraft | null {
  if (draft === null) return null;
  const doc = library.documents.find((entry) => entry.id === draft.document_id);
  const pack = doc?.kind === 'pack';
  const items = pack ? decodePackDefinition(draft.definition)?.items : [];
  return {
    kind: pack ? 'pack' : 'puzzle',
    title: draft.title,
    valid: pack
      ? items !== undefined
      : examplePuzzleContent.rules.validateDefinition(draft.definition).valid,
    contents: (items ?? []).map(
      (item) =>
        library.revisions.find((edition) => edition.id === item.revisionId)
          ?.title ?? 'Unavailable puzzle'
    ),
  };
}

export async function editingDraftView(
  s: ContentHarness,
  clientId: string
): Promise<EditingDraft | null> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  return viewOf(library, workingContentDraft(library, editingDocument(s)));
}

const MISSING: EditingDraft = {
  kind: 'puzzle',
  title: '',
  valid: false,
  contents: [],
};

export async function draftEditingState(s: ContentHarness) {
  const library = await readContentLibrary(contentClient(s, ALICE).db);
  const documentId = editingDocument(s);
  const offered = await offeredDraftEdits(s, ALICE, documentId);
  return {
    draft: viewOf(library, workingContentDraft(library, documentId)) ?? MISSING,
    otherDraft: (await editingDraftView(s, 'alice:tablet')) ?? MISSING,
    keptCopies: new Set(
      new Map(
        contentDraftCopies(library, documentId).flatMap((draft) => {
          const view = viewOf(library, draft);
          return view === null ? [] : [[JSON.stringify(view), view] as const];
        })
      ).values()
    ),
    undoOffered: offered.undo,
    redoOffered: offered.redo,
  };
}

export const DRAFT_EDITING_ACTIONS = [
  setupDraftEditing,
  saveEditingDraft,
] as const;
