import {
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient, currentContentEditor } from './content-actions';
import { contentActorId } from './content-identity';
import type { ContentHarness } from './content-system';
import { examplePuzzleContent } from './example-app-rules';

export async function puzzlePublicationState(s: ContentHarness) {
  const id = currentContentEditor(s, 'alice:phone').documentId;
  const [owner, tablet, reader] = await Promise.all([
    readContentLibrary(contentClient(s, 'alice:phone').db),
    readContentLibrary(contentClient(s, 'alice:tablet').db),
    readContentLibrary(contentClient(s, 'bob:phone').db),
  ]);
  const document = owner.documents.find((doc) => doc.id === id);
  const otherDocument = tablet.documents.find((doc) => doc.id === id);
  const drafts = s.lifecycleDrafts.map((choice) => {
    const draft = owner.drafts.find((copy) => copy.id === choice);
    if (draft === undefined)
      throw new Error('A saved publication draft disappeared');
    return {
      title: draft.title,
      valid: examplePuzzleContent.rules.validateDefinition(draft.definition)
        .valid,
    };
  });
  const editions = new Map(
    owner.revisions
      .filter((edition) => edition.document_id === id)
      .map(
        (edition) =>
          [
            s.lifecycleDrafts.indexOf(edition.id),
            {
              title: edition.title,
              valid: examplePuzzleContent.rules.validateDefinition(
                edition.definition
              ).valid,
              author:
                edition.owner_id === contentActorId('alice')
                  ? 'Alice'
                  : edition.owner_id,
            },
          ] as const
      )
  );
  const discovered = discoverContent(reader, 'counting').find(
    (edition) => edition.document_id === id
  );
  const current = discoverContent(owner, 'counting').find(
    (edition) => edition.document_id === id
  );
  return {
    drafts,
    editions,
    workingDraft: s.lifecycleDrafts.indexOf(document?.working_draft_id ?? ''),
    otherDraft: s.lifecycleDrafts.indexOf(
      otherDocument?.working_draft_id ?? ''
    ),
    currentEdition: s.lifecycleDrafts.indexOf(current?.id ?? ''),
    discoveredEdition: s.lifecycleDrafts.indexOf(discovered?.id ?? ''),
  };
}
