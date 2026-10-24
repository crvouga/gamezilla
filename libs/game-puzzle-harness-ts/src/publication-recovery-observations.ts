import {
  discoverContent,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

export async function publicationRecoveryState(s: ContentHarness) {
  const packId = s.selectedPacks.get('alice:phone') ?? '';
  const puzzleId = s.documents.get('River');
  const [phone, tablet, reader] = await Promise.all([
    readContentLibrary(contentClient(s, 'alice:phone').db),
    readContentLibrary(contentClient(s, 'alice:tablet').db),
    readContentLibrary(contentClient(s, 'bob:phone').db),
  ]);
  const discoverable = discoverContent(reader, 'counting').some(
    (edition) => edition.document_id === packId
  );
  const choice = s.publicationResults.get(packId);
  const outcome =
    choice?.ok === true
      ? await contentClient(s, 'alice:phone').engine.mutationOutcome(
          choice.mutationId
        )
      : null;
  const publication = discoverable
    ? 'published'
    : choice === undefined
      ? 'draft'
      : !choice.ok || outcome === 'rejected'
        ? 'refused'
        : outcome === 'pending'
          ? 'waiting'
          : 'published';
  return {
    draftKept: workingContentDraft(phone, packId) !== null,
    puzzleAvailable: discoverContent(tablet, 'counting').some(
      (edition) => edition.document_id === puzzleId
    ),
    availableOnPhone: discoverContent(phone, 'counting').some(
      (edition) => edition.document_id === puzzleId
    ),
    publication,
    discoverable,
  };
}
