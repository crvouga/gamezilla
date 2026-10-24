import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  changeAttemptFor,
  restartAttemptFor,
  selectedPlay,
  startAttemptFor,
} from './attempt-actions';
import {
  contentClient,
  createDraftFor,
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import { publishCurrentContent } from './content-publication-actions';
import type { ContentHarness } from './content-system';

export const setupAttemptLifecycle = defineAction({
  name: 'setupAttemptLifecycle',
  act: async (s: ContentHarness) => {
    await createDraftFor(s, 'bob:phone', { title: 'River', valid: true });
    const editor = currentContentEditor(s, 'bob:phone');
    editor.body = { ...editor.body, definition: 'target:3' };
    await saveContentEditor(s, 'bob:phone');
    await publishCurrentContent(s, 'bob:phone');
  },
});

export const startLifecycleAttempt = defineAction({
  name: 'startLifecycleAttempt',
  act: async (s: ContentHarness) => {
    await startAttemptFor(s, 'bob:phone', { title: 'River' });
    if (s.lastResult.get('bob:phone')?.ok === true)
      s.lifecycleAttempts.push(selectedPlay(s, 'bob:phone').attemptId);
  },
});

export const advanceLifecycleAttempt = defineAction({
  name: 'advanceLifecycleAttempt',
  act: (s: ContentHarness) =>
    changeAttemptFor(s, 'bob:phone', { kind: 'play', action: 'step1' }),
});

export const restartLifecycleAttempt = defineAction({
  name: 'restartLifecycleAttempt',
  act: async (s: ContentHarness) => {
    await restartAttemptFor(s, 'bob:phone');
    if (s.lastResult.get('bob:phone')?.ok === true)
      s.lifecycleAttempts.push(selectedPlay(s, 'bob:phone').attemptId);
  },
});

export const resumeLifecycleAttempt = defineAction({
  name: 'resumeLifecycleAttempt',
  act: async (s: ContentHarness, index: number) => {
    const id = s.lifecycleAttempts[index];
    const play = await readAttemptLibrary(contentClient(s, 'bob:phone').db);
    const attempt = play.attempts.find((entry) => entry.id === id);
    if (attempt === undefined) throw new Error('Choose a saved attempt');
    s.playSelections.set('bob:phone', {
      attemptId: attempt.id,
      positionId: attempt.current_position_id,
    });
  },
});

export const publishAttemptPuzzleEdition = defineAction({
  name: 'publishAttemptPuzzleEdition',
  act: async (s: ContentHarness) => {
    await saveContentEditor(s, 'bob:phone');
    await publishCurrentContent(s, 'bob:phone');
  },
});

export const withdrawAttemptPuzzle = defineAction({
  name: 'withdrawAttemptPuzzle',
  act: async (s: ContentHarness) => {
    await sendContentMutation(s, 'bob:phone', 'withdrawPuzzleContent', {
      documentId: currentContentEditor(s, 'bob:phone').documentId,
    });
  },
});

export const ATTEMPT_LIFECYCLE_ACTIONS = [
  setupAttemptLifecycle,
  startLifecycleAttempt,
  advanceLifecycleAttempt,
  restartLifecycleAttempt,
  resumeLifecycleAttempt,
  publishAttemptPuzzleEdition,
  withdrawAttemptPuzzle,
] as const;
