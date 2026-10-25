import { puzzleAvailabilityMessage } from '@libs/game-puzzle-shared-ts/attempt-availability';
import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

export async function contentDraftAvailable(
  s: ContentHarness,
  clientId: string,
  title: string
): Promise<boolean> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  // The draft created with this title, or the one the device is editing.
  return [s.documents.get(title), s.editors.get(clientId)?.documentId].some(
    (id) => workingContentDraft(library, id ?? '')?.title === title
  );
}

export function unavailableAttemptNotice(
  s: ContentHarness,
  clientId: string
): string | null {
  const result = s.lastResult.get(clientId);
  return result?.ok === false &&
    result.failures[0]?.code === 'PUZZLE_UNAVAILABLE'
    ? puzzleAvailabilityMessage(!s.offline.has(clientId))
    : null;
}

export async function completionRecordCount(
  s: ContentHarness,
  clientId: string
): Promise<number> {
  return (await readAttemptLibrary(contentClient(s, clientId).db)).completions
    .length;
}
