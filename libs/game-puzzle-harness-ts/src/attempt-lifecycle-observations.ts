import { attemptHistoryStates } from '@libs/game-puzzle-shared-ts/attempt-history';
import {
  attemptContinuations,
  projectAttemptPosition,
  readAttemptLibrary,
} from '@libs/game-puzzle-shared-ts/attempt-library';
import { decodeAttemptHistory } from '@libs/game-puzzle-shared-ts/attempt-types';
import {
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient, currentContentEditor } from './content-actions';
import type { ContentHarness } from './content-system';
import { examplePuzzleContent } from './example-app-rules';

async function completedEditions(s: ContentHarness, clientId: string) {
  const content = await readContentLibrary(contentClient(s, clientId).db);
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  return new Set(
    play.completions.map(
      (completion) =>
        content.revisions.find(
          (edition) => edition.id === completion.puzzle_revision_id
        )?.edition ?? -1
    )
  );
}

export async function attemptLifecycleState(s: ContentHarness) {
  const content = await readContentLibrary(contentClient(s, 'bob:phone').db);
  const play = await readAttemptLibrary(contentClient(s, 'bob:phone').db);
  const documentId = currentContentEditor(s, 'bob:phone').documentId;
  const attempts = s.lifecycleAttempts.map((id) => {
    const attempt = play.attempts.find((entry) => entry.id === id);
    const position = play.positions.find(
      (entry) => entry.id === attempt?.current_position_id
    );
    const source = content.revisions.find(
      (edition) => edition.id === attempt?.source_id
    );
    const history = decodeAttemptHistory(position?.history ?? '');
    if (attempt === undefined || source === undefined || history === null)
      throw new Error('A saved attempt is unavailable');
    const finished = play.positions.some(
      (kept) =>
        kept.attempt_id === id &&
        projectAttemptPosition({
          position: kept,
          definition: source.definition,
          game: examplePuzzleContent,
        })?.complete === true
    );
    return {
      edition: source.edition,
      history: (
        attemptHistoryStates({
          game: examplePuzzleContent,
          definition: source.definition,
          history,
        }) ?? []
      ).map((state) => Number(state.slice('count:'.length))),
      cursor: history.cursor,
      finished,
    };
  });
  return {
    attempts,
    keptContinuations: new Set(
      s.lifecycleAttempts.flatMap((id, index) =>
        attemptContinuations(play, id).length > 1 ? [index] : []
      )
    ),
    activeAttempt: s.lifecycleAttempts.indexOf(
      s.playSelections.get('bob:phone')?.attemptId ?? ''
    ),
    completions: await completedEditions(s, 'bob:phone'),
    otherCompletions: await completedEditions(s, 'bob:tablet'),
    currentEdition: content.revisions
      .filter((edition) => edition.document_id === documentId)
      .reduce((latest, edition) => Math.max(latest, edition.edition), 0),
    available: discoverContent(content, 'counting').some(
      (edition) => edition.document_id === documentId
    ),
  };
}
