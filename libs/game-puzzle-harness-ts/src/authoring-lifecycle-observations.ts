import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import {
  discoverContent,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import type { ContentDraft } from '@libs/game-puzzle-shared-ts/content-types';
import { currentAttemptView } from './attempt-observations';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';
import { examplePuzzleContent } from './example-app-rules';

function draftView(draft: ContentDraft | null) {
  return {
    exists: draft !== null,
    title: draft?.title ?? '',
    valid:
      draft !== null &&
      examplePuzzleContent.rules.validateDefinition(draft.definition).valid,
    described:
      draft?.description === 'Connect the riverbanks' &&
      draft.difficulty === 'Gentle',
  };
}

export async function privatePuzzleAuthoringState(s: ContentHarness) {
  const id = s.documents.get('River') ?? '';
  const [owner, tablet, reader, play, practice] = await Promise.all([
    readContentLibrary(contentClient(s, 'alice:phone').db),
    readContentLibrary(contentClient(s, 'alice:tablet').db),
    readContentLibrary(contentClient(s, 'bob:phone').db),
    readAttemptLibrary(contentClient(s, 'alice:phone').db),
    currentAttemptView(s, 'alice:phone'),
  ]);
  const source = owner.drafts.find((draft) => draft.id === practice?.editionId);
  return {
    draft: draftView(workingContentDraft(owner, id)),
    otherDraft: draftView(workingContentDraft(tablet, id)),
    playtest: {
      exists: practice !== null,
      title: practice?.title ?? '',
      valid:
        source !== undefined &&
        examplePuzzleContent.rules.validateDefinition(source.definition).valid,
      completed: practice?.complete ?? false,
    },
    otherCanRead: reader.drafts.some((draft) => draft.document_id === id),
    discoverable: discoverContent(reader, 'counting').some(
      (edition) => edition.document_id === id
    ),
    ordinaryAttempts: play.attempts.filter(
      (attempt) => attempt.mode === 'ordinary'
    ).length,
    ordinaryCompletions: play.completions.length,
  };
}
