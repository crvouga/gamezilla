import { expect, test } from 'bun:test';
import { DMN_INPUT } from '@libs/permissions-shared/people';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import {
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpace,
} from '@libs/spaces-harness/space-decision-world';
import { renameSpaceMutation } from '@libs/spaces-shared/rename-space-mutation';

test.each(['guest', 'free account', 'Plus member'])(
  '%s host renames a space through the permission replay host',
  async (person) => {
    // regression: space-role-rename-missing-content-rules
    const layer = serverEnforcementLayer({
      tables: SPACE_TABLES,
      seed: seedPlaceInSpace,
      operationFor: () =>
        replayOperation(renameSpaceMutation, () => ({
          spaceId: SPACE_ID,
          title: 'Renamed',
        })),
    });
    expect(
      await layer.decide(
        {
          [DMN_INPUT.who]: person,
          [DMN_INPUT.place]: 'host',
          [DMN_INPUT.capability]: 'rename a space',
        },
        { decisionId: 'space-roles', caseId: person, world: undefined }
      )
    ).toEqual({ answer: 'yes' });
  }
);
