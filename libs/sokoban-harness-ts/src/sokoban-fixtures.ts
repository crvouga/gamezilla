import {
  contentClient,
  sendContentMutation,
} from '@libs/game-puzzle-harness-ts/content-actions';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { solveSokoban } from '@libs/sokoban-shared-ts/sokoban-solver';
import { deviceLibrary, waitFor } from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

/** A small board that a fixture can always prove and publish. */
export const PLAIN_BOARD = JSON.stringify({
  format: 1,
  rows: ['#####', '#@$.#', '#####'],
});

function accepted(s: SokobanHarness, clientId: string, what: string): void {
  const result = s.lastResult.get(clientId);
  if (result?.ok !== true)
    throw new Error(`${what} was refused: ${JSON.stringify(result)}`);
}

export async function createSokobanDraft(
  s: SokobanHarness,
  clientId: string,
  args: { readonly title: string; readonly definition: string }
): Promise<{ readonly documentId: string; readonly draftId: string }> {
  const documentId = s.session.ports.createId();
  const draftId = s.session.ports.createId();
  const body = {
    title: args.title,
    description: '',
    difficulty: '',
    definition: args.definition,
  };
  await sendContentMutation(s, clientId, 'createPuzzleContent', {
    documentId,
    draftId,
    gameId: 'sokoban',
    kind: 'puzzle',
    body,
  });
  accepted(s, clientId, 'Creating the Sokoban draft');
  s.documents.set(args.title, documentId);
  s.selectedPuzzles.set(clientId, documentId);
  s.editors.set(clientId, { documentId, parentId: draftId, body });
  return { documentId, draftId };
}

/** A shortest solution the real rules accept, found for fixture boards only. */
export function witnessFor(definition: string): readonly string[] {
  const board = decodeSokobanBoard(definition);
  if (!board.valid) throw new Error('A fixture board must be readable');
  const solution = solveSokoban(board.value, { maxStates: 200_000 });
  if (solution.status !== 'solved')
    throw new Error(`A fixture board must be solvable: ${solution.status}`);
  return solution.actions;
}

/** Plays a playtest of the draft through the shared mutations, action by action. */
export async function playtestByMutation(
  s: SokobanHarness,
  clientId: string,
  draft: { readonly documentId: string; readonly draftId: string },
  actions: readonly string[]
): Promise<string> {
  const attemptId = s.session.ports.createId();
  let parentId = s.session.ports.createId();
  await sendContentMutation(s, clientId, 'startPuzzlePlaytest', {
    documentId: draft.documentId,
    draftId: draft.draftId,
    attemptId,
    positionId: parentId,
  });
  accepted(s, clientId, 'Starting the playtest');
  for (const action of actions) {
    const positionId = s.session.ports.createId();
    await sendContentMutation(s, clientId, 'changePuzzleAttempt', {
      attemptId,
      parentId,
      positionId,
      command: { kind: 'play', action },
    });
    accepted(s, clientId, 'A playtest move');
    parentId = positionId;
  }
  return attemptId;
}

/** Alice builds, proves and publishes a Sokoban puzzle; returns its edition. */
export async function arrangePublishedSokoban(
  s: SokobanHarness,
  args: { readonly title: string; readonly definition: string }
): Promise<string> {
  const draft = await createSokobanDraft(s, 'alice:phone', args);
  const attemptId = await playtestByMutation(
    s,
    'alice:phone',
    draft,
    witnessFor(args.definition)
  );
  await sendContentMutation(s, 'alice:phone', 'publishPuzzleContent', {
    documentId: draft.documentId,
    draftId: draft.draftId,
    playtestAttemptId: attemptId,
  });
  accepted(s, 'alice:phone', 'Publishing the Sokoban puzzle');
  return draft.draftId;
}

export async function arrangePublishedPack(
  s: SokobanHarness,
  args: {
    readonly title: string;
    readonly puzzles: readonly {
      readonly title: string;
      readonly definition: string;
    }[];
  }
): Promise<string> {
  const items = [];
  for (const puzzle of args.puzzles)
    items.push({
      puzzleId: '',
      revisionId: await arrangePublishedSokoban(s, puzzle),
    });
  const definition = JSON.stringify({
    items: items.map((item, index) => ({
      puzzleId: s.documents.get(args.puzzles[index]?.title ?? '') ?? '',
      revisionId: item.revisionId,
    })),
  });
  const documentId = s.session.ports.createId();
  const draftId = s.session.ports.createId();
  await sendContentMutation(s, 'alice:phone', 'createPuzzleContent', {
    documentId,
    draftId,
    gameId: 'sokoban',
    kind: 'pack',
    body: { title: args.title, description: '', difficulty: '', definition },
  });
  accepted(s, 'alice:phone', 'Creating the pack');
  await sendContentMutation(s, 'alice:phone', 'publishPuzzleContent', {
    documentId,
    draftId,
  });
  accepted(s, 'alice:phone', 'Publishing the pack');
  s.documents.set(args.title, documentId);
  return draftId;
}

/** Waits until the device holds an edition, as its screens would show it. */
export async function awaitEdition(
  s: SokobanHarness,
  clientId: string,
  revisionId: string
): Promise<void> {
  await waitFor(s, async () =>
    (await deviceLibrary(s, clientId)).revisions.some(
      (edition) => edition.id === revisionId
    )
  );
}

export async function startAttemptByMutation(
  s: SokobanHarness,
  clientId: string,
  edition: {
    readonly revisionId: string;
    readonly packRevisionId: string | null;
  }
): Promise<string> {
  await awaitEdition(s, clientId, edition.revisionId);
  if (edition.packRevisionId !== null)
    await awaitEdition(s, clientId, edition.packRevisionId);
  const attemptId = s.session.ports.createId();
  const positionId = s.session.ports.createId();
  await sendContentMutation(s, clientId, 'startPuzzleAttempt', {
    attemptId,
    positionId,
    revisionId: edition.revisionId,
    packRevisionId: edition.packRevisionId,
  });
  accepted(s, clientId, 'Starting the attempt');
  s.playSelections.set(clientId, { attemptId, positionId });
  return attemptId;
}

export function deviceDb(s: SokobanHarness, clientId: string) {
  return contentClient(s, clientId).db;
}
