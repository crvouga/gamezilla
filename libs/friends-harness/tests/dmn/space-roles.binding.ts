/**
 * `specs/spaces/space-roles.dmn` against the permission system. Both layers
 * observe the answer alone: the product refuses "only the host" and "not in
 * the space" the same way (`not_granted`; `SPACE_PERMISSION_DENIED`).
 *
 * - application decision — the kernel's decision for the case's person with
 *   their presence role in the space;
 * - server enforcement — the real operation, against a server database
 *   holding the space (hosted by the person, joined by them, or neither):
 *   the leave, rename, end and member-management mutations replayed as the
 *   server replays them, and the space room's handler for the game choice;
 * - client gating — `useSpaceCan` on the person's device, their presence
 *   read from the synced space rows (the space open on the device).
 */

import { clientGatingLayer } from '@libs/permissions-harness/client';
import { spaceRolesApplicationLayer } from '@libs/permissions-shared/application';
import { grantKeyOf } from '@libs/permissions-shared/capabilities';
import { capabilityOf } from '@libs/permissions-shared/people';
import type { ServerOperation } from '@libs/permissions-shared/server';
import {
  allOperations,
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import {
  chooseGame,
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpace,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces-harness/space-decision-world';
import { addSpaceUserMutation } from '@libs/spaces-shared/add-space-user-mutation';
import { endSpaceMutation } from '@libs/spaces-shared/end-space-mutation';
import { leaveSpaceMutation } from '@libs/spaces-shared/leave-space-mutation';
import { removeSpaceUserMutation } from '@libs/spaces-shared/remove-space-user-mutation';
import { renameSpaceMutation } from '@libs/spaces-shared/rename-space-mutation';
import { bindDecisions } from '@pkgs/dmn-shared/registry';

const OPERATIONS: Readonly<Record<string, ServerOperation>> = {
  'leave the space': replayOperation(leaveSpaceMutation, () => ({
    spaceId: SPACE_ID,
  })),
  'rename a space': replayOperation(renameSpaceMutation, () => ({
    spaceId: SPACE_ID,
    title: 'Renamed',
  })),
  'end a space': replayOperation(endSpaceMutation, () => ({
    spaceId: SPACE_ID,
  })),
  'manage who is in the space': allOperations([
    replayOperation(addSpaceUserMutation, () => ({
      spaceId: SPACE_ID,
      userId: 'newcomer',
    })),
    replayOperation(removeSpaceUserMutation, () => ({
      spaceId: SPACE_ID,
      userId: 'newcomer',
    })),
  ]),
  'make the game choice': chooseGame,
};

bindDecisions({
  spec: 'space-roles',
  layers: {
    'application decision': spaceRolesApplicationLayer(),
    'server enforcement': serverEnforcementLayer({
      tables: SPACE_TABLES,
      seed: seedPlaceInSpace,
      operationFor: (input) => OPERATIONS[capabilityOf(input)] ?? null,
    }),
    'client gating': clientGatingLayer({
      tables: SPACE_TABLES,
      seed: seedPlaceInSpaceOnDevice,
      probe: (input) => {
        const can = useSpaceCan(SPACE_ID, grantKeyOf(capabilityOf(input)));
        return () => ({ answer: can() ? 'yes' : 'no' });
      },
    }),
  },
});
