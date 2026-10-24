import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import { publishCurrentContent } from './content-publication-actions';
import { selectContentDocument, selectPackEditor } from './content-selection';
import type { ContentHarness } from './content-system';

export const publishOtherPackDraft = defineAction({
  name: 'publishOtherPackDraft',
  act: async (s: ContentHarness) => {
    await selectPackEditor(s, 'alice:phone');
    const source = currentContentEditor(s, 'alice:phone');
    await sendContentMutation(s, 'bob:phone', 'publishPuzzleContent', {
      documentId: source.documentId,
      draftId: source.parentId,
    });
  },
});

export const publishEarlierPack = defineAction({
  name: 'publishEarlierPack',
  act: async (s: ContentHarness, titles: string) => {
    const packId = s.selectedPacks.get('alice:phone');
    const earlier = s.publishedDrafts.get(`${packId}:${titles}`);
    if (earlier === undefined)
      throw new Error('Choose a previously published pack order');
    await sendContentMutation(
      s,
      'alice:phone',
      'publishPuzzleContent',
      earlier
    );
  },
});

export const resumeEarlierContentAttempt = defineAction({
  name: 'resumeEarlierContentAttempt',
  act: async (s: ContentHarness, clientId: string) => {
    const earlier = s.earlierPlay.get(clientId);
    if (earlier === undefined) throw new Error('Choose an earlier attempt');
    const play = await readAttemptLibrary(contentClient(s, clientId).db);
    const attempt = play.attempts.find(
      (entry) => entry.id === earlier.attemptId
    );
    if (attempt === undefined)
      throw new Error('The earlier attempt is unavailable');
    s.playSelections.set(clientId, {
      attemptId: attempt.id,
      positionId: attempt.current_position_id,
    });
  },
});

export const reviseChosenPackPuzzle = defineAction({
  name: 'reviseChosenPackPuzzle',
  act: async (s: ContentHarness, title: string, newTitle: string) => {
    const documentId = s.documents.get(title);
    if (documentId === undefined)
      throw new Error('Choose a puzzle already in the pack');
    await selectContentDocument(s, 'alice:phone', documentId);
    const editor = currentContentEditor(s, 'alice:phone');
    editor.body = { ...editor.body, title: newTitle };
    await saveContentEditor(s, 'alice:phone');
    await publishCurrentContent(s, 'alice:phone');
  },
});

export const RETAINED_CONTENT_ACTIONS = [
  publishOtherPackDraft,
  publishEarlierPack,
  resumeEarlierContentAttempt,
  reviseChosenPackPuzzle,
] as const;
