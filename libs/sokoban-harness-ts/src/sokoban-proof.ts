import { closeBuilders } from '@libs/game-puzzle-harness-ts/builder-session';
import { discoveredOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { builtDefinition, openSokobanBuilder } from './sokoban-building';
import { completeOnScreen } from './sokoban-play';
import {
  closePlay,
  devicePlay,
  openAttemptOnScreen,
  screensOf,
  type View,
  waitFor,
} from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

const ALICE = 'alice:phone';
const PUBLISHED = new WeakMap<SokobanHarness, Map<string, string>>();
const NEEDS_PLAYTEST = 'Complete a playtest of this board before publication.';

/** A person presses a control once it shows its idle face again. */
async function clickIdle(
  s: SokobanHarness,
  view: View,
  testId: string,
  idle: string
): Promise<void> {
  await waitFor(
    s,
    () => view.queryByTestId(testId)?.textContent?.trim() === idle
  );
  s.lastResult.delete(ALICE);
  fireEvent.click(view.getByTestId(testId));
}

function documentOf(s: SokobanHarness): string {
  const id = s.editors.get(ALICE)?.documentId;
  if (id === undefined) throw new Error('Alice owns no Sokoban draft');
  return id;
}

async function newestPlaytest(s: SokobanHarness): Promise<string | null> {
  const documentId = documentOf(s);
  return (
    (await devicePlay(s, ALICE)).attempts
      .filter(
        (attempt) =>
          attempt.mode === 'playtest' && attempt.puzzle_id === documentId
      )
      .toSorted((a, b) => b.activity_order - a.activity_order)[0]?.id ?? null
  );
}

/** Starts a playtest from the builder; a board with corrections is refused there. */
export async function playtestFromBuilder(s: SokobanHarness): Promise<void> {
  const view = await openSokobanBuilder(s);
  const earlier = await newestPlaytest(s);
  await clickIdle(s, view, 'content-start-playtest', 'Start playtest');
  await waitFor(s, () => s.lastResult.has(ALICE));
  const attemptId = await newestPlaytest(s);
  if (s.lastResult.get(ALICE)?.ok !== true || attemptId === earlier) return;
  if (attemptId !== null) await openAttemptOnScreen(s, ALICE, attemptId);
}

export const playtestSokobanDraft = defineAction({
  name: 'playtestSokobanDraft',
  act: playtestFromBuilder,
});

export const completeSokobanPlaytest = defineAction({
  name: 'completeSokobanPlaytest',
  act: async (s: SokobanHarness) => {
    if (screensOf(s, ALICE).play === null) await playtestFromBuilder(s);
    await completeOnScreen(s, ALICE);
    closePlay(s, ALICE);
  },
});

/** Leaving before every crate is on a goal: the playtest stays unfinished. */
export const stopSokobanPlaytest = defineAction({
  name: 'stopSokobanPlaytest',
  act: async (s: SokobanHarness) => {
    if (screensOf(s, ALICE).play === null) await playtestFromBuilder(s);
    closePlay(s, ALICE);
  },
});

export const publishSokobanDraft = defineAction({
  name: 'publishSokobanDraft',
  act: async (s: SokobanHarness) => {
    const view = await openSokobanBuilder(s);
    const board = await builtDefinition(s);
    await clickIdle(s, view, 'content-publish', 'Publish');
    await waitFor(s, () => s.lastResult.has(ALICE));
    if (s.lastResult.get(ALICE)?.ok !== true) return;
    const title = s.editors.get(ALICE)?.body.title ?? '';
    const published = PUBLISHED.get(s) ?? new Map<string, string>();
    published.set(title, board);
    PUBLISHED.set(s, published);
  },
});

/** An app update with other rules closes every open screen, play included. */
export const changeSokobanRules = defineAction({
  name: 'changeSokobanRules',
  act: (s: SokobanHarness) => {
    for (const clientId of ['alice:phone', 'alice:tablet', 'bob:phone'])
      closePlay(s, clientId);
    s.rules.version += 1;
    closeBuilders(s);
  },
});

export async function proofShown(s: SokobanHarness): Promise<boolean> {
  const view = await openSokobanBuilder(s);
  return (
    view.queryByTestId('content-proof')?.getAttribute('data-proven') === 'true'
  );
}

export function toldToPlaytest(s: SokobanHarness): boolean {
  const result = s.lastResult.get(ALICE);
  return (
    result?.ok === false &&
    result.failures[0]?.code === 'PUZZLE_PUBLICATION_INVALID' &&
    result.failures[0].message === NEEDS_PLAYTEST
  );
}

export async function publicationWaiting(s: SokobanHarness): Promise<boolean> {
  const view = await openSokobanBuilder(s);
  return view.queryByTestId('content-publication-pending') !== null;
}

/** Bob's device offers the edition under the current rules. */
export async function playableBy(
  s: SokobanHarness,
  clientId: string,
  title: string
): Promise<string | null> {
  const edition = (await discoveredOnDevice(s, clientId))
    .filter((entry) => entry.kind === 'puzzle' && entry.title === title)
    .find((entry) => entry.rules_version === s.content.rulesVersion);
  return edition?.definition ?? null;
}

export function publishedBoard(s: SokobanHarness, title: string): string {
  return PUBLISHED.get(s)?.get(title) ?? '';
}

export async function privatePlaytestOpens(
  s: SokobanHarness
): Promise<boolean> {
  const attemptId = await newestPlaytest(s);
  if (attemptId === null) return false;
  const view = await openAttemptOnScreen(s, ALICE, attemptId);
  return view.queryByTestId('sokoban-board') !== null;
}

export async function ordinaryCompletions(
  s: SokobanHarness,
  clientId: string
): Promise<number> {
  const documentId = s.editors.get(ALICE)?.documentId;
  return (await devicePlay(s, clientId)).completions.filter(
    (entry) => entry.puzzle_id === documentId
  ).length;
}

export const SOKOBAN_PROOF_ACTIONS = [
  playtestSokobanDraft,
  completeSokobanPlaytest,
  stopSokobanPlaytest,
  publishSokobanDraft,
  changeSokobanRules,
] as const;
