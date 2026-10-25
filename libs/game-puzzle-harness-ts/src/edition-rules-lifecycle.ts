import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import type { ContentRevision } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import {
  arrangePublishedContent,
  publishCurrentContent,
} from './content-publication-actions';
import { selectPuzzleEditor } from './content-selection';
import type { ContentHarness } from './content-system';
import { resumeAttemptOnScreen } from './edition-rules-actions';

const ALICE = 'alice:phone';
const BOB = 'bob:phone';

async function riverEditions(
  s: ContentHarness,
  clientId: string
): Promise<readonly ContentRevision[]> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  return library.revisions
    .filter((edition) => edition.document_id === s.documents.get('River'))
    .toSorted((a, b) => a.edition - b.edition);
}

export const setupEditionRules = defineAction({
  name: 'setupEditionRules',
  act: (s: ContentHarness) => arrangePublishedContent.act(s, 'River'),
});

export const publishRiverEdition = defineAction({
  name: 'publishRiverEdition',
  act: async (s: ContentHarness) => {
    const editor = currentContentEditor(s, ALICE);
    editor.body = {
      ...editor.body,
      description: `Edition ${(await riverEditions(s, ALICE)).length + 1}`,
    };
    await saveContentEditor(s, ALICE);
    await selectPuzzleEditor(s, ALICE);
    await publishCurrentContent(s, ALICE);
  },
});

/** Bob starts an edition his phone has; one it lacks offline cannot start. */
export const startRiverEdition = defineAction({
  name: 'startRiverEdition',
  act: async (s: ContentHarness, index: number) => {
    const edition = (await riverEditions(s, BOB))[index];
    if (edition === undefined) return;
    const attemptId = s.session.ports.createId();
    const positionId = s.session.ports.createId();
    const started = await sendContentMutation(s, BOB, 'startPuzzleAttempt', {
      attemptId,
      positionId,
      revisionId: edition.id,
      packRevisionId: null,
    });
    if (started) s.playSelections.set(BOB, { attemptId, positionId });
  },
});

/** Bob reopens his saved attempt at an edition; other rules keep it closed. */
export const resumeRiverEdition = defineAction({
  name: 'resumeRiverEdition',
  act: async (s: ContentHarness, index: number) => {
    const edition = (await riverEditions(s, BOB))[index];
    const play = await readAttemptLibrary(contentClient(s, BOB).db);
    const attempt = play.attempts
      .filter(
        (entry) => entry.mode === 'ordinary' && entry.source_id === edition?.id
      )
      .toSorted((a, b) => b.activity_order - a.activity_order)[0];
    if (attempt === undefined) return;
    const earlier = s.playSelections.get(BOB);
    s.playSelections.set(BOB, {
      attemptId: attempt.id,
      positionId: attempt.current_position_id,
    });
    await resumeAttemptOnScreen(s, BOB);
    if (s.notices.get(BOB) === 'PUZZLE_RULES_CHANGED') {
      if (earlier === undefined) s.playSelections.delete(BOB);
      else s.playSelections.set(BOB, earlier);
    }
  },
});

/** The model numbers rules from 0, the product from 1. */
export async function editionRulesState(s: ContentHarness) {
  const rules = s.rules.version - 1;
  const published = await riverEditions(s, ALICE);
  const onPhone = await riverEditions(s, BOB);
  const play = await readAttemptLibrary(contentClient(s, BOB).db);
  const index = (sourceId: string) =>
    published.findIndex((edition) => edition.id === sourceId);
  const active = play.attempts.find(
    (attempt) => attempt.id === s.playSelections.get(BOB)?.attemptId
  );
  const playing =
    active === undefined || active.rules_version - 1 !== rules
      ? -1
      : index(active.source_id);
  return {
    editions: published.map((edition) => edition.rules_version - 1),
    rules,
    attempts: new Set(
      play.attempts
        .filter((attempt) => attempt.mode === 'ordinary')
        .map((attempt) => index(attempt.source_id))
    ),
    activeAttempt: playing,
    availableOnPhone: new Set(
      onPhone.map((edition) => index(edition.id)).filter((at) => at >= 0)
    ),
  };
}

export const EDITION_RULES_LIFECYCLE_ACTIONS = [
  setupEditionRules,
  publishRiverEdition,
  startRiverEdition,
  resumeRiverEdition,
] as const;
