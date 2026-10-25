import { editTitleInBuilder } from '@libs/game-puzzle-harness-ts/builder-session';
import { attemptOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  builtDefinition,
  editSquare,
  openSokobanBuilder,
} from './sokoban-building';
import { createSokobanDraft } from './sokoban-fixtures';
import { proofShown, publicationWaiting } from './sokoban-proof';
import { deviceLibrary, devicePlay, screensOf } from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

const ALICE = 'alice:phone';
/** Boards 0 and 1 have nothing to correct; board 2 lacks its worker. */
const BOARDS = [
  ['#####', '#@$.#', '#####'],
  ['~####', '#@$.#', '#####'],
  ['#####', '# $.#', '#####'],
].map((rows) => JSON.stringify({ format: 1, rows }));
const TITLES = ['First Steps', 'Gentle Start'];

const boardIndex = (definition: string): number => BOARDS.indexOf(definition);

export const setupPublicationProof = defineAction({
  name: 'setupPublicationProof',
  act: async (s: SokobanHarness) => {
    await createSokobanDraft(s, ALICE, {
      title: TITLES[0] ?? '',
      definition: BOARDS[0] ?? '',
    });
    await openSokobanBuilder(s);
  },
});

/** Board edits between the model's boards: A1 outside, B2 the worker. */
export const editProofBoard = defineAction({
  name: 'editProofBoard',
  act: async (s: SokobanHarness, next: number) => {
    const from = boardIndex(await builtDefinition(s));
    const outsideA1 = (board: number) => board === 1;
    const worker = (board: number) => board !== 2;
    if (worker(from) && !worker(next)) await editSquare(s, 'erase', 'B2');
    if (outsideA1(from) !== outsideA1(next))
      await editSquare(s, outsideA1(next) ? 'outside' : 'wall', 'A1');
    if (!worker(from) && worker(next)) await editSquare(s, 'worker', 'B2');
  },
});

export const editProofDetails = defineAction({
  name: 'editProofDetails',
  act: (s: SokobanHarness, details: number) =>
    editTitleInBuilder.act(s, ALICE, TITLES[details] ?? ''),
});

/** The latest playtest: what it plays, under which rules, and how it stands. */
async function latestPlaytest(s: SokobanHarness) {
  const documentId = s.editors.get(ALICE)?.documentId;
  const attempt = (await devicePlay(s, ALICE)).attempts
    .filter(
      (entry) => entry.mode === 'playtest' && entry.puzzle_id === documentId
    )
    .toSorted((a, b) => b.activity_order - a.activity_order)[0];
  if (attempt === undefined) return { board: -1, rules: -1, status: 'none' };
  const saved = await attemptOnDevice(s, ALICE, attempt.id);
  const complete =
    saved !== null &&
    sokobanPuzzleContent.rules.complete(saved.definition, saved.state);
  const open = screensOf(s, ALICE).play?.attemptId === attempt.id;
  return {
    board: boardIndex(saved?.definition ?? ''),
    rules: attempt.rules_version - 1,
    status: complete ? 'completed' : open ? 'playing' : 'stopped',
  };
}

export async function publicationProofState(s: SokobanHarness) {
  const documentId = s.editors.get(ALICE)?.documentId;
  // Editions as the authority shared them: another person's device sees them.
  const editions = (await deviceLibrary(s, 'bob:phone')).revisions
    .filter((edition) => edition.document_id === documentId)
    .toSorted((a, b) => a.edition - b.edition)
    .map((edition) => ({
      board: boardIndex(edition.definition),
      details: TITLES.indexOf(edition.title),
      rules: edition.rules_version - 1,
    }));
  const library = await deviceLibrary(s, ALICE);
  const working = library.documents.find(
    (doc) => doc.id === documentId
  )?.working_draft_id;
  const title = library.drafts.find((draft) => draft.id === working)?.title;
  return {
    board: boardIndex(await builtDefinition(s)),
    details: TITLES.indexOf(title ?? ''),
    rules: s.rules.version - 1,
    playtest: await latestPlaytest(s),
    proof: await proofShown(s),
    editions,
    waiting: await publicationWaiting(s),
  };
}

export const SOKOBAN_PROOF_MODEL_ACTIONS = [
  setupPublicationProof,
  editProofBoard,
  editProofDetails,
] as const;
