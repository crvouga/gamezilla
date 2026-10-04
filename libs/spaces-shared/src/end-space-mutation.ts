import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';

import {
  endSpace,
  requireSpacePermission,
  spaceIdArgs,
} from './space-mutation-helpers';
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
