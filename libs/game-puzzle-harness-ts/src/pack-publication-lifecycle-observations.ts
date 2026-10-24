import {
  type ContentLibrary,
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

function references(
  s: ContentHarness,
  library: ContentLibrary,
  definition: string
) {
  const pack = decodePackDefinition(definition);
  if (pack === null) throw new Error('A kept pack edition is unreadable');
  return pack.items.map((item) => ({
    puzzle: s.lifecyclePuzzles.indexOf(item.puzzleId),
    edition:
      item.revisionId === null
        ? 0
        : (library.revisions.find((revision) => revision.id === item.revisionId)
            ?.edition ?? -1),
  }));
}

export async function packPublicationState(s: ContentHarness) {
  const id = s.selectedPacks.get('alice:phone');
  const [owner, tablet, reader] = await Promise.all([
    readContentLibrary(contentClient(s, 'alice:phone').db),
    readContentLibrary(contentClient(s, 'alice:tablet').db),
    readContentLibrary(contentClient(s, 'bob:phone').db),
  ]);
  const document = owner.documents.find((doc) => doc.id === id);
  const otherDocument = tablet.documents.find((doc) => doc.id === id);
  const drafts = s.lifecycleDrafts.flatMap((choice) => {
    const draft = owner.drafts.find((copy) => copy.id === choice);
    return draft === undefined ? [] : [references(s, owner, draft.definition)];
  });
  const editions = new Map(
    owner.revisions
      .filter((edition) => edition.document_id === id)
      .map(
        (edition) =>
          [
            s.lifecycleDrafts.indexOf(edition.id),
            references(s, owner, edition.definition),
          ] as const
      )
  );
  const discovered = discoverContent(reader, 'counting').find(
    (edition) => edition.document_id === id
  );
  const current = discoverContent(owner, 'counting').find(
    (edition) => edition.document_id === id
  );
  const puzzleEditions = new Map(
    s.lifecyclePuzzles.map(
      (puzzle, index) =>
        [
          index,
          owner.revisions
            .filter((edition) => edition.document_id === puzzle)
            .reduce((latest, edition) => Math.max(latest, edition.edition), 0),
        ] as const
    )
  );
  const availablePuzzles = new Set(
    discoverContent(owner, 'counting')
      .filter((edition) => s.lifecyclePuzzles.includes(edition.document_id))
      .map((edition) => s.lifecyclePuzzles.indexOf(edition.document_id))
  );
  return {
    drafts,
    editions,
    puzzleEditions,
    availablePuzzles,
    workingDraft: s.lifecycleDrafts.indexOf(document?.working_draft_id ?? ''),
    otherDraft: s.lifecycleDrafts.indexOf(
      otherDocument?.working_draft_id ?? ''
    ),
    currentEdition: s.lifecycleDrafts.indexOf(current?.id ?? ''),
    discoveredEdition: s.lifecycleDrafts.indexOf(discovered?.id ?? ''),
  };
}
