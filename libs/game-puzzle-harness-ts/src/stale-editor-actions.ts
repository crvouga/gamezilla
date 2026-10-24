import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { changeAttemptFor, selectedPlay } from './attempt-actions';
import {
  contentClient,
  currentContentEditor,
  sendContentMutation,
} from './content-actions';
import type { ContentHarness } from './content-system';
import { lifecyclePuzzle } from './pack-publication-lifecycle-actions';
import { lifecycleDraft } from './publication-lifecycle-actions';

async function earlierDraft(s: ContentHarness) {
  const library = await readContentLibrary(contentClient(s, 'alice:tablet').db);
  const draft = library.drafts.find((copy) => copy.id === lifecycleDraft(s, 0));
  if (draft === undefined)
    throw new Error('The tablet must retain the earlier draft');
  return draft;
}

async function saveEarlierDraft(
  s: ContentHarness,
  body: ReturnType<typeof contentBody>
) {
  const draftId = s.session.ports.createId();
  if (
    await sendContentMutation(s, 'alice:tablet', 'savePuzzleContentDraft', {
      documentId: currentContentEditor(s, 'alice:phone').documentId,
      parentId: lifecycleDraft(s, 0),
      draftId,
      body,
    })
  )
    s.lifecycleDrafts.push(draftId);
}

export const saveEarlierPublicationDraft = defineAction({
  name: 'saveEarlierPublicationDraft',
  act: async (s: ContentHarness, title: string, valid: boolean) => {
    const draft = await earlierDraft(s);
    await saveEarlierDraft(s, {
      ...contentBody(draft),
      title,
      definition: valid ? 'target:2' : 'target:',
    });
  },
});

export const saveEarlierPackPublicationDraft = defineAction({
  name: 'saveEarlierPackPublicationDraft',
  act: async (s: ContentHarness, order: readonly number[]) => {
    const draft = await earlierDraft(s);
    const pack = decodePackDefinition(draft.definition);
    if (pack === null) throw new Error('The earlier pack must be readable');
    const items = order.map((index) => {
      const item = pack.items.find(
        (entry) => entry.puzzleId === lifecyclePuzzle(s, index)
      );
      if (item === undefined)
        throw new Error('Choose a puzzle from the earlier pack');
      return item;
    });
    await saveEarlierDraft(s, {
      ...contentBody(draft),
      definition: JSON.stringify({ items }),
    });
  },
});

export const continueEarlierLifecycleAttempt = defineAction({
  name: 'continueEarlierLifecycleAttempt',
  act: async (s: ContentHarness) => {
    const phone = selectedPlay(s, 'bob:phone');
    const play = await readAttemptLibrary(contentClient(s, 'bob:tablet').db);
    const first = play.positions.find(
      (position) =>
        position.attempt_id === phone.attemptId && position.parent_id === null
    );
    if (first === undefined)
      throw new Error('The tablet must retain the earlier position');
    s.playSelections.set('bob:tablet', {
      attemptId: phone.attemptId,
      positionId: first.id,
    });
    await changeAttemptFor(s, 'bob:tablet', { kind: 'play', action: 'step2' });
  },
});

export const STALE_EDITOR_ACTIONS = [
  saveEarlierPublicationDraft,
  saveEarlierPackPublicationDraft,
  continueEarlierLifecycleAttempt,
] as const;
