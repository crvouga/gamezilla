import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { changeAttemptFor, startAttemptFor } from './attempt-actions';
import { currentAttemptView } from './attempt-observations';
import type { ContentHarness } from './content-system';
import { arrangePackFor, arrangePublishedPuzzle } from './pack-fixtures';
import { openPackFor, startPackPuzzleFor } from './pack-play-actions';

export async function completeExampleAttempt(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const view = await currentAttemptView(s, clientId);
  await changeAttemptFor(s, clientId, {
    kind: 'play',
    action: view?.state === 'count:1' ? 'step1' : 'step2',
  });
}

export async function rememberAttempt(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const view = await currentAttemptView(s, clientId);
  if (view === null) throw new Error('The fixture attempt is missing');
  s.rememberedStates.set(clientId, view.state);
  s.rememberedEditions.set(clientId, view.editionId);
}

export const arrangePersonalAttempt = defineAction({
  name: 'arrangePersonalAttempt',
  act: async (
    s: ContentHarness,
    args: {
      readonly title: string;
      readonly fresh?: boolean;
      readonly completed?: boolean;
      readonly pack?: string;
      readonly puzzles?: string;
    }
  ) => {
    const clientId = 'bob:phone';
    if (args.pack === undefined) {
      await arrangePublishedPuzzle(s, args.title);
      await startAttemptFor(s, clientId, { title: args.title });
    } else {
      await arrangePackFor(s, {
        title: args.pack,
        titles: (args.puzzles ?? 'River, Valley').split(', '),
        published: true,
      });
      await openPackFor(s, clientId, args.pack);
      await startPackPuzzleFor(s, clientId, args.title);
    }
    if (!args.fresh)
      await changeAttemptFor(s, clientId, { kind: 'play', action: 'step1' });
    if (args.completed) await completeExampleAttempt(s, clientId);
    await rememberAttempt(s, clientId);
  },
});

export const finishContentAttempt = defineAction({
  name: 'finishContentAttempt',
  act: completeExampleAttempt,
});

export const copyAttemptToTablet = defineAction({
  name: 'copyAttemptToTablet',
  act: (s: ContentHarness) => {
    const selection = s.playSelections.get('bob:phone');
    if (selection === undefined) throw new Error('A phone attempt is required');
    s.playSelections.set('bob:tablet', { ...selection });
  },
});

export const ATTEMPT_FIXTURES = [
  arrangePersonalAttempt,
  finishContentAttempt,
  copyAttemptToTablet,
] as const;
