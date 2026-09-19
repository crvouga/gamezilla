import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine/shared';

import {
  endSpace,
  requireSpacePermission,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const endSpaceMutation = defineMutation({
  name: 'endSpace',
  args: spaceIdArgs,
  async run({ tx, env }, { spaceId }) {
    await requireSpacePermission(tx, env, {
      spaceId,
      permission: PERMISSION.spacesEnd,
      message: 'Only the host can end this space.',
    });
    await endSpace(tx, env, spaceId);
  },
});
