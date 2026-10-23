import { changePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/change-attempt-mutation';
import { choosePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/choose-content-draft-mutation';
import { puzzleContentOwned } from '@libs/game-puzzle-shared-ts/content-queries';
import { createPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { editPuzzlePackMutation } from '@libs/game-puzzle-shared-ts/edit-pack-mutation';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { savePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { startPuzzlePlaytestMutation } from '@libs/game-puzzle-shared-ts/start-playtest-mutation';
import { withdrawPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/withdraw-content-mutation';
import { grantKeyOf } from '@libs/permissions-shared-ts/capabilities';
import {
  type CaseInput,
  capabilityOf,
} from '@libs/permissions-shared-ts/people';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  allOperations,
  queryGuardOperation,
  replayOperation,
  type ServerOperation,
} from '@libs/permissions-shared-ts/server';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import { exampleContentCatalog } from './example-app';
import {
  DECISION_ATTEMPT,
  DECISION_BODY,
  DECISION_DRAFT,
  DECISION_POSITION,
  DECISION_PUZZLE,
} from './puzzle-decision-world';

const readOwn: ServerOperation = async (c) => {
  await queryGuardOperation(PERMISSION.puzzlesReadOwnContent)(c);
  const rows = await puzzleContentOwned.run(
    {
      db: {
        query: (query) => c.db.query(query as Sql<Record<string, unknown>>),
      },
      env: c.env,
    },
    { gameId: 'counting', afterId: '' }
  );
  for (const table of Object.values(rows))
    for (const row of table) {
      if (row['owner_id'] !== c.env.actorId)
        throw new Error('The private query exposed another person’s work');
    }
};

const edit = allOperations([
  replayOperation(savePuzzleContentDraftMutation, () => ({
    documentId: DECISION_PUZZLE,
    parentId: DECISION_DRAFT,
    draftId: 'edited-draft',
    body: { ...DECISION_BODY, title: 'Evening river' },
  })),
  replayOperation(editPuzzlePackMutation, () => ({
    documentId: 'decision-pack',
    parentId: 'decision-pack-draft',
    draftId: 'edited-pack-draft',
    edit: { kind: 'remove', puzzleId: 'available-puzzle' },
  })),
  replayOperation(choosePuzzleContentDraftMutation, () => ({
    documentId: DECISION_PUZZLE,
    chosenDraftId: DECISION_DRAFT,
    expectedDraftId: 'edited-draft',
    draftId: 'chosen-draft',
  })),
]);

const publish = allOperations([
  replayOperation(publishPuzzleContentMutation(exampleContentCatalog), () => ({
    documentId: DECISION_PUZZLE,
    draftId: DECISION_DRAFT,
  })),
  replayOperation(publishPuzzleContentMutation(exampleContentCatalog), () => ({
    documentId: 'decision-pack',
    draftId: 'decision-pack-draft',
  })),
  replayOperation(withdrawPuzzleContentMutation, () => ({
    documentId: DECISION_PUZZLE,
  })),
  replayOperation(withdrawPuzzleContentMutation, () => ({
    documentId: 'decision-pack',
  })),
]);

/** The real replay or private query that performs each granted capability. */
export function puzzleDecisionOperation(input: CaseInput): ServerOperation {
  const key = grantKeyOf(capabilityOf(input));
  switch (key) {
    case PERMISSION.puzzlesCreateContent:
      return replayOperation(
        createPuzzleContentMutation(exampleContentCatalog),
        () => ({
          documentId: 'new-puzzle',
          draftId: 'new-draft',
          gameId: 'counting',
          kind: 'puzzle',
          body: DECISION_BODY,
        })
      );
    case PERMISSION.puzzlesReadOwnContent:
      return readOwn;
    case PERMISSION.puzzlesEditContent:
      return edit;
    case PERMISSION.puzzlesPublishContent:
      return publish;
    case PERMISSION.puzzlesPlaytestContent:
      return replayOperation(
        startPuzzlePlaytestMutation(exampleContentCatalog),
        () => ({
          documentId: DECISION_PUZZLE,
          draftId: DECISION_DRAFT,
          attemptId: 'new-playtest',
          positionId: 'new-playtest-position',
        })
      );
    case PERMISSION.puzzlesEditAttempt:
      return replayOperation(
        changePuzzleAttemptMutation(exampleContentCatalog),
        () => ({
          attemptId: DECISION_ATTEMPT,
          parentId: DECISION_POSITION,
          positionId: 'continued-position',
          command: { kind: 'play', action: 'step1' },
        })
      );
    default:
      throw new Error(`No puzzle operation performs ${key}`);
  }
}
