import {
  type ContentLibrary,
  contentDraftCopies,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import type { ContentDraft } from '@libs/game-puzzle-shared-ts/content-types';
import { contentClient, currentContentEditor } from './content-actions';
import { currentSavedContentDraft } from './content-observations';
import type { ContentHarness } from './content-system';
import {
  controlOffered,
  openDraftEditor,
  REDO_DRAFT_EDIT,
  UNDO_DRAFT_EDIT,
} from './draft-editor-screen';
import { examplePuzzleContent } from './example-app-rules';

/** Whether the builder offers undo and redo for the open draft (`null`: no such control). */
export async function draftEditChoices(
  s: ContentHarness,
  clientId: string
): Promise<{ readonly undo: boolean | null; readonly redo: boolean | null }> {
  const { view } = await openDraftEditor(s, clientId);
  try {
    return {
      undo: controlOffered(view, UNDO_DRAFT_EDIT),
      redo: controlOffered(view, REDO_DRAFT_EDIT),
    };
  } finally {
    view.unmount();
  }
}

export async function contentDraftHasValidDetails(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const draft = await currentSavedContentDraft(s, clientId);
  return (
    draft !== null &&
    examplePuzzleContent.rules.validateDefinition(draft.definition).valid
  );
}

function editingDraft(library: ContentLibrary, draft: ContentDraft | null) {
  const kind =
    library.documents.find((doc) => doc.id === draft?.document_id)?.kind ?? '';
  const pack =
    kind === 'pack' ? decodePackDefinition(draft?.definition ?? '') : null;
  return {
    kind,
    title: draft?.title ?? '',
    valid:
      kind === 'pack'
        ? pack !== null
        : draft !== null &&
          examplePuzzleContent.rules.validateDefinition(draft.definition).valid,
    contents:
      pack?.items.map(
        (item) => workingContentDraft(library, item.puzzleId)?.title ?? ''
      ) ?? [],
  };
}

/** The draft-editing model's variables, read from Alice's phone and tablet. */
export async function draftEditingState(s: ContentHarness) {
  const documentId = currentContentEditor(s, 'alice:phone').documentId;
  const [phone, tablet, choices] = await Promise.all([
    readContentLibrary(contentClient(s, 'alice:phone').db),
    readContentLibrary(contentClient(s, 'alice:tablet').db),
    draftEditChoices(s, 'alice:phone'),
  ]);
  return {
    draft: editingDraft(phone, workingContentDraft(phone, documentId)),
    otherDraft: editingDraft(tablet, workingContentDraft(tablet, documentId)),
    keptCopies: new Set(
      new Map(
        contentDraftCopies(phone, documentId).map((copy) => {
          const kept = editingDraft(phone, copy);
          return [JSON.stringify(kept), kept] as const;
        })
      ).values()
    ),
    undoOffered: choices.undo === true,
    redoOffered: choices.redo === true,
  };
}
