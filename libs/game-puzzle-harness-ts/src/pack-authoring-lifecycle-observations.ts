import {
  type ContentLibrary,
  discoverContent,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { AUTHORING_PUZZLE_TITLES } from './authoring-lifecycle-actions';
import { contentClient } from './content-actions';
import { contentActorId } from './content-identity';
import type { ContentHarness } from './content-system';

function packView(s: ContentHarness, library: ContentLibrary) {
  const draft = workingContentDraft(
    library,
    s.selectedPacks.get('alice:phone') ?? ''
  );
  return {
    exists: draft !== null,
    contents:
      decodePackDefinition(draft?.definition ?? '')?.items.map((item) =>
        AUTHORING_PUZZLE_TITLES.findIndex(
          (title) => s.documents.get(title) === item.puzzleId
        )
      ) ?? [],
  };
}

export async function privatePackAuthoringState(s: ContentHarness) {
  const [owner, tablet, reader] = await Promise.all([
    readContentLibrary(contentClient(s, 'alice:phone').db),
    readContentLibrary(contentClient(s, 'alice:tablet').db),
    readContentLibrary(contentClient(s, 'bob:phone').db),
  ]);
  const id = s.selectedPacks.get('alice:phone') ?? '';
  const draft = workingContentDraft(owner, id);
  const puzzleId = s.documents.get('Meadow') ?? '';
  return {
    draft: packView(s, owner),
    otherDraft: packView(s, tablet),
    createdPuzzle: owner.documents.some(
      (document) =>
        document.id === puzzleId &&
        document.owner_id === contentActorId('alice') &&
        workingContentDraft(owner, document.id) !== null
    ),
    discoverable: discoverContent(reader, 'counting').some(
      (edition) => edition.document_id === id
    ),
    title: draft?.title ?? '',
    description: draft?.description ?? '',
  };
}
