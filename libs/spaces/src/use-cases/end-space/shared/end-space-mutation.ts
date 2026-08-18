import { defineMutation } from '@pkgs/sync-engine/shared';

import {
  endSpace,
  requireHost,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const endSpaceMutation = defineMutation({
  name: 'endSpace',
  args: spaceIdArgs,
  async run({ tx, env }, { spaceId }) {
    await requireHost(tx, env, spaceId, 'Only the host can end this space.');
    await endSpace(tx, env, spaceId);
  },
});
