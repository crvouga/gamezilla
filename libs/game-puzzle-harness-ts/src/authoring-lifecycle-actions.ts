import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  currentContentEditor,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import type { ContentHarness } from './content-system';
import { arrangePublishedPuzzle } from './pack-fixtures';

export const setupPrivatePuzzleAuthoring = defineAction({
  name: 'setupPrivatePuzzleAuthoring',
  act: (s: ContentHarness) => {
    s.games.set('alice:phone', 'counting');
  },
});

export const saveAuthoringDraft = defineAction({
  name: 'saveAuthoringDraft',
  act: async (
    s: ContentHarness,
    args: {
      readonly person: string;
      readonly title: string;
      readonly valid: boolean;
      readonly described: boolean;
    }
  ) => {
    const source = currentContentEditor(s, 'alice:phone');
    const body = {
      title: args.title,
      definition: args.valid ? 'target:2' : 'target:',
      description: args.described ? 'Connect the riverbanks' : '',
      difficulty: args.described ? 'Gentle' : '',
    };
    if (args.person === 'Alice') {
      source.body = body;
      await saveContentEditor(s, 'alice:phone');
    } else
      await sendContentMutation(s, 'bob:phone', 'savePuzzleContentDraft', {
        documentId: source.documentId,
        parentId: source.parentId,
        draftId: s.session.ports.createId(),
        body,
      });
  },
});

export const AUTHORING_PUZZLE_TITLES = [
  'River',
  'Valley',
  'Harbor',
  'Meadow',
  'Other Harbor',
] as const;

export function authoringPuzzleId(s: ContentHarness, index: number): string {
  const title = AUTHORING_PUZZLE_TITLES[index];
  const id = title === undefined ? undefined : s.documents.get(title);
  if (id === undefined) throw new Error(`Unknown authoring puzzle: ${index}`);
  return id;
}

export const setupPrivatePackAuthoring = defineAction({
  name: 'setupPrivatePackAuthoring',
  act: async (s: ContentHarness) => {
    for (const title of ['River', 'Valley', 'Harbor'])
      await arrangePublishedPuzzle(s, title);
    s.games.set('alice:phone', 'other-counting');
    await arrangePublishedPuzzle(s, 'Other Harbor');
    s.games.set('alice:phone', 'counting');
  },
});

export const AUTHORING_LIFECYCLE_ACTIONS = [
  setupPrivatePuzzleAuthoring,
  saveAuthoringDraft,
  setupPrivatePackAuthoring,
] as const;
