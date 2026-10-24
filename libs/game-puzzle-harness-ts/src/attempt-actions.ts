import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { AttemptCommand } from '@libs/game-puzzle-shared-ts/attempt-types';
import {
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  currentContentEditor,
  sendContentMutation,
} from './content-actions';
import type { ContentHarness, PlaySelection } from './content-system';

export function selectedPlay(
  s: ContentHarness,
  clientId: string
): PlaySelection {
  const selection = s.playSelections.get(clientId);
  if (selection === undefined) throw new Error('Open a puzzle attempt first');
  return selection;
}

export async function startAttemptFor(
  s: ContentHarness,
  clientId: string,
  args: {
    readonly title: string;
    readonly packRevisionId?: string;
    readonly revisionId?: string;
  }
): Promise<void> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  const revision = discoverContent(library, 'counting').find(
    (edition) => edition.kind === 'puzzle' && edition.title === args.title
  );
  const attemptId = s.session.ports.createId();
  const positionId = s.session.ports.createId();
  if (
    await sendContentMutation(s, clientId, 'startPuzzleAttempt', {
      attemptId,
      positionId,
      revisionId:
        args.revisionId ??
        revision?.id ??
        s.documents.get(args.title) ??
        args.title,
      packRevisionId: args.packRevisionId ?? null,
    })
  )
    s.playSelections.set(clientId, { attemptId, positionId });
}

export async function changeAttemptFor(
  s: ContentHarness,
  clientId: string,
  command: AttemptCommand
): Promise<void> {
  const selection = selectedPlay(s, clientId);
  const positionId = s.session.ports.createId();
  if (
    await sendContentMutation(s, clientId, 'changePuzzleAttempt', {
      attemptId: selection.attemptId,
      parentId: selection.positionId,
      positionId,
      command,
    })
  )
    s.playSelections.set(clientId, { ...selection, positionId });
}

export const startStandaloneAttempt = defineAction({
  name: 'startStandaloneAttempt',
  act: startAttemptFor,
});
export const changeContentAttempt = defineAction({
  name: 'changeContentAttempt',
  act: changeAttemptFor,
});

export async function restartAttemptFor(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const earlier = selectedPlay(s, clientId);
  const attemptId = s.session.ports.createId();
  const positionId = s.session.ports.createId();
  if (
    await sendContentMutation(s, clientId, 'restartPuzzleAttempt', {
      earlierAttemptId: earlier.attemptId,
      attemptId,
      positionId,
    })
  ) {
    s.earlierPlay.set(clientId, earlier);
    s.playSelections.set(clientId, { attemptId, positionId });
  }
}

export const restartContentAttempt = defineAction({
  name: 'restartContentAttempt',
  act: restartAttemptFor,
});

export const playtestContentDraft = defineAction({
  name: 'playtestContentDraft',
  act: async (s: ContentHarness, clientId: string) => {
    const editor = currentContentEditor(s, 'alice:phone');
    const library = await readContentLibrary(contentClient(s, clientId).db);
    if (!library.drafts.some((draft) => draft.id === editor.parentId)) {
      s.notices.set(clientId, 'private');
      return;
    }
    const attemptId = s.session.ports.createId();
    const positionId = s.session.ports.createId();
    const accepted = await sendContentMutation(
      s,
      clientId,
      'startPuzzlePlaytest',
      {
        documentId: editor.documentId,
        draftId: editor.parentId,
        attemptId,
        positionId,
      }
    );
    if (accepted) s.playSelections.set(clientId, { attemptId, positionId });
  },
});

export const openOtherAttempt = defineAction({
  name: 'openOtherAttempt',
  act: async (s: ContentHarness) => {
    const source = selectedPlay(s, 'bob:phone');
    const library = await readAttemptLibrary(
      contentClient(s, 'alice:phone').db
    );
    if (!library.attempts.some((attempt) => attempt.id === source.attemptId))
      s.notices.set('alice:phone', 'private');
  },
});

export const ATTEMPT_ACTIONS = [
  startStandaloneAttempt,
  changeContentAttempt,
  restartContentAttempt,
  playtestContentDraft,
  openOtherAttempt,
] as const;
