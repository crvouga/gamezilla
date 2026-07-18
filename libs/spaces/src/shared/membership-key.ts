/**
 * Re-exports Meet-style identity helpers.
 * Prefer importing from `participation/participation-ids` for new code.
 */
export {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
  spaceDeviceMembershipEntityId,
  spaceGuestMembershipEntityId,
} from './participation/participation-ids';
