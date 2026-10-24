import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { CONTENT_TABLES } from '@libs/game-puzzle-shared-ts/content-tables';
import { createPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { startPuzzlePlaytestMutation } from '@libs/game-puzzle-shared-ts/start-playtest-mutation';
import type { AccessScope } from '@libs/permissions-shared-ts/access-scope';
import type { CaseInput } from '@libs/permissions-shared-ts/people';
import { identityFor, personOf } from '@libs/permissions-shared-ts/people';
import {
  replayOperation,
  type ServerCase,
} from '@libs/permissions-shared-ts/server';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { exampleContentCatalog } from './example-app';

export const PUZZLE_DECISION_TABLES = uniqueTables([
  ...CONTENT_TABLES,
  ...BILLING_TABLES,
]);
export const DECISION_PUZZLE = 'decision-puzzle';
export const DECISION_DRAFT = 'decision-draft';
export const DECISION_ATTEMPT = 'decision-attempt';
export const DECISION_POSITION = 'decision-position';
export const DECISION_BODY = {
  title: 'River',
  description: '',
  difficulty: '',
  definition: 'target:2',
};

export function puzzleDecisionOwner(input: CaseInput): string {
  if (input['is it their work'] === 'yes')
    return identityFor(personOf(input)).actorId;
  if (input['is it their work'] === 'no') return 'another-author';
  throw new Error('Puzzle access case must say whose work it is');
}

export function puzzleDecisionScope(input: CaseInput): AccessScope {
  const owner = puzzleDecisionOwner(input);
  return { puzzleOwnerId: owner, puzzlePlayerId: owner };
}

/** Complete, valid private work exists before the operation whose permission is measured. */
export async function seedPuzzleDecision(c: ServerCase): Promise<void> {
  const owner = {
    ...c,
    env: { ...c.env, actorId: puzzleDecisionOwner(c.input) },
  };
  await replayOperation(
    createPuzzleContentMutation(exampleContentCatalog),
    () => ({
      documentId: DECISION_PUZZLE,
      draftId: DECISION_DRAFT,
      gameId: 'counting',
      kind: 'puzzle',
      body: DECISION_BODY,
    })
  )(owner);
  await replayOperation(
    startPuzzlePlaytestMutation(exampleContentCatalog),
    () => ({
      documentId: DECISION_PUZZLE,
      draftId: DECISION_DRAFT,
      attemptId: DECISION_ATTEMPT,
      positionId: DECISION_POSITION,
    })
  )(owner);
  // A separate available edition makes a valid pack publication possible as well.
  await replayOperation(
    createPuzzleContentMutation(exampleContentCatalog),
    () => ({
      documentId: 'available-puzzle',
      draftId: 'available-draft',
      gameId: 'counting',
      kind: 'puzzle',
      body: DECISION_BODY,
    })
  )(owner);
  await replayOperation(
    publishPuzzleContentMutation(exampleContentCatalog),
    () => ({ documentId: 'available-puzzle', draftId: 'available-draft' })
  )(owner);
  await replayOperation(
    createPuzzleContentMutation(exampleContentCatalog),
    () => ({
      documentId: 'decision-pack',
      draftId: 'decision-pack-draft',
      gameId: 'counting',
      kind: 'pack',
      body: {
        ...DECISION_BODY,
        title: 'River pack',
        definition: JSON.stringify({
          items: [
            { puzzleId: 'available-puzzle', revisionId: 'available-draft' },
          ],
        }),
      },
    })
  )(owner);
}
