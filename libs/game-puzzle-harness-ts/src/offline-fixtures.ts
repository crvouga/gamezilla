import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { changeAttemptFor, startAttemptFor } from './attempt-actions';
import { completeExampleAttempt, rememberAttempt } from './attempt-fixtures';
import { createDraftFor, saveContentEditor } from './content-actions';
import type { ContentHarness } from './content-system';
import { disconnectContentDevice } from './offline-actions';
import { arrangePackFor, arrangePublishedPuzzle } from './pack-fixtures';
import { openPackFor, startPackPuzzleFor } from './pack-play-actions';

export const arrangeOfflineDraft = defineAction({
  name: 'arrangeOfflineDraft',
  act: async (s: ContentHarness, title: string) => {
    disconnectContentDevice(s, 'alice:phone');
    await createDraftFor(s, 'alice:phone', { title, valid: false });
    await saveContentEditor(s, 'alice:phone');
  },
});

export const arrangeOfflinePlay = defineAction({
  name: 'arrangeOfflinePlay',
  act: async (s: ContentHarness, title: string) => {
    await arrangePublishedPuzzle(s, title);
    await startAttemptFor(s, 'bob:phone', { title });
    disconnectContentDevice(s, 'bob:phone');
    await changeAttemptFor(s, 'bob:phone', { kind: 'play', action: 'step1' });
    await rememberAttempt(s, 'bob:phone');
  },
});

export const arrangeUnavailableOfflinePuzzle = defineAction({
  name: 'arrangeUnavailableOfflinePuzzle',
  act: async (s: ContentHarness) => {
    await arrangePublishedPuzzle(s, 'Valley');
    await startAttemptFor(s, 'bob:phone', { title: 'Valley' });
    await changeAttemptFor(s, 'bob:phone', { kind: 'play', action: 'step1' });
    await rememberAttempt(s, 'bob:phone');
    disconnectContentDevice(s, 'bob:phone');
  },
});

export const arrangeOfflinePackCompletion = defineAction({
  name: 'arrangeOfflinePackCompletion',
  act: async (
    s: ContentHarness,
    args: {
      readonly title: string;
      readonly pack: string;
      readonly puzzles: string;
    }
  ) => {
    await arrangePackFor(s, {
      title: args.pack,
      titles: args.puzzles.split(', '),
      published: true,
    });
    await openPackFor(s, 'bob:phone', args.pack);
    await startPackPuzzleFor(s, 'bob:phone', args.title);
    disconnectContentDevice(s, 'bob:phone');
    await completeExampleAttempt(s, 'bob:phone');
    await rememberAttempt(s, 'bob:phone');
  },
});

export const OFFLINE_FIXTURES = [
  arrangeOfflineDraft,
  arrangeOfflinePlay,
  arrangeUnavailableOfflinePuzzle,
  arrangeOfflinePackCompletion,
] as const;
