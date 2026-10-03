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

import { spaceRolesApplicationLayer } from '@libs/permissions/root/conformance/application';
import { grantKeyOf } from '@libs/permissions/root/conformance/capabilities';
import { clientGatingLayer } from '@libs/permissions/root/conformance/client';
import { capabilityOf } from '@libs/permissions/root/conformance/people';
import {
  allOperations,
  replayOperation,
  type ServerOperation,
  serverEnforcementLayer,
} from '@libs/permissions/root/conformance/server';
import {
  chooseGame,
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpace,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces/harness/space-decision-world';
import { useSpaceCan } from '@libs/spaces/public/use-space-can';
import {
  addSpaceUserMutation,
  endSpaceMutation,
  leaveSpaceMutation,
  removeSpaceUserMutation,
  renameSpaceMutation,
} from '@libs/spaces/root/mutations';
import { bindDecisions } from '@pkgs/dmn/registry';

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
