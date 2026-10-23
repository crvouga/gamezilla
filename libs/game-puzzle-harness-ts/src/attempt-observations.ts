import { currentAttemptState } from '@libs/game-puzzle-shared-ts/attempt-history';
import {
  attemptContinuations,
  projectAttemptPosition,
  readAttemptLibrary,
} from '@libs/game-puzzle-shared-ts/attempt-library';
import { decodeAttemptHistory } from '@libs/game-puzzle-shared-ts/attempt-types';
import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';
import { exampleContentCatalog } from './example-app';

export async function currentAttemptView(s: ContentHarness, clientId: string) {
  const selected = s.playSelections.get(clientId);
  if (selected === undefined) return null;
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  const content = await readContentLibrary(contentClient(s, clientId).db);
  const attempt = play.attempts.find(
    (entry) => entry.id === selected.attemptId
  );
  const position = play.positions.find(
    (entry) =>
      entry.id === selected.positionId && entry.attempt_id === attempt?.id
  );
  if (attempt === undefined || position === undefined) return null;
  const source =
    attempt.mode === 'playtest'
      ? content.drafts.find((draft) => draft.id === attempt.source_id)
      : content.revisions.find((edition) => edition.id === attempt.source_id);
  const game = exampleContentCatalog.byId(attempt.game_id);
  if (source === undefined || game === undefined) return null;
  const view = projectAttemptPosition({
    position,
    definition: source.definition,
    game,
  });
  return view === null
    ? null
    : {
        ...view,
        title: source.title,
        editionId: source.id,
        mode: attempt.mode,
        attemptId: attempt.id,
      };
}

export async function ordinaryCompletionTitles(
  s: ContentHarness,
  clientId: string
): Promise<readonly string[]> {
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  const content = await readContentLibrary(contentClient(s, clientId).db);
  return play.completions.flatMap((completion) =>
    content.revisions
      .filter((edition) => edition.id === completion.puzzle_revision_id)
      .map((edition) => edition.title)
  );
}

export async function ordinaryAttemptTitles(
  s: ContentHarness,
  clientId: string
): Promise<readonly string[]> {
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  const content = await readContentLibrary(contentClient(s, clientId).db);
  return play.attempts
    .filter((attempt) => attempt.mode === 'ordinary')
    .flatMap((attempt) =>
      content.revisions
        .filter((edition) => edition.id === attempt.source_id)
        .map((edition) => edition.title)
    );
}

export async function earlierAttemptVisible(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const earlier = s.earlierPlay.get(clientId);
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  return (
    earlier !== undefined &&
    play.attempts.some((attempt) => attempt.id === earlier.attemptId) &&
    play.positions.some((position) => position.id === earlier.positionId)
  );
}

export async function keptAttemptStates(
  s: ContentHarness,
  clientId: string
): Promise<readonly string[]> {
  const attemptId = s.playSelections.get(clientId)?.attemptId;
  if (attemptId === undefined) return [];
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  return attemptContinuations(play, attemptId).flatMap((position) => {
    const history = decodeAttemptHistory(position.history);
    return history === null ? [] : [currentAttemptState(history)];
  });
}
