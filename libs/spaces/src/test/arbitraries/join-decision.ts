import { arbDistinctUserPair, arbUserId } from '@pkgs/pbt';
import type { Arbitrary } from 'fast-check';
import fc from 'fast-check';

import type { SpaceAccessInput } from '../../shared/space/participation/space-participation-policy';

export const arbJoinDecisionInput = (): Arbitrary<SpaceAccessInput> =>
  fc
    .tuple(
      fc.constantFrom('public', 'private') as Arbitrary<'public' | 'private'>,
      arbUserId(),
      arbUserId(),
      arbUserId(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean()
    )
    .map(
      ([
        visibility,
        hostAccountId,
        viewerAccountId,
        deviceId,
        hasSpaceUser,
        isFriendOfHost,
        viewerIsHost,
      ]) => {
        const hostMemberId = hostAccountId;
        const hostId = `host-device-${deviceId}`;
        return {
          visibility,
          hostId,
          hostAccountId,
          hostMemberId,
          viewerAccountId: viewerIsHost ? hostAccountId : viewerAccountId,
          viewerDeviceId: viewerIsHost ? hostId : `viewer-${deviceId}`,
          viewerMemberId: viewerIsHost ? hostMemberId : viewerAccountId,
          hasSpaceUser,
          isFriendOfHost,
        } satisfies SpaceAccessInput;
      }
    );

export { arbDistinctUserPair, arbUserId };
