import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';

import { useSpaceColumn, SpaceField } from '../use-space-column';
import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

export type SpaceHostMembershipDisplay = {
  readonly deviceId: string;
  readonly membershipId: string;
  readonly profileId: string;
  readonly deviceLabel: string | null;
};

/** Host seat display fields from the host's membership row. */
export function useSpaceHostMembershipDisplay(
  spaceId: string
): SpaceHostMembershipDisplay | null {
  const hostDeviceId = useSpaceColumn(spaceId, SpaceField.hostId);
  const membershipId =
    hostDeviceId !== null && hostDeviceId.length > 0
      ? spaceDeviceMembershipEntityId(hostDeviceId, spaceId)
      : '';
  const profileRaw = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.profileId
  );
  const deviceLabel = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.deviceLabel
  );
  if (hostDeviceId === null || hostDeviceId.length === 0) return null;
  const profileId =
    profileRaw !== null && profileRaw.length > 0 ? profileRaw : hostDeviceId;
  return {
    deviceId: hostDeviceId,
    membershipId,
    profileId,
    deviceLabel,
  };
}
