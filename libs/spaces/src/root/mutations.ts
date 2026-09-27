import { addSpaceUserMutation } from '../use-cases/add-space-user/shared/add-space-user-mutation';
import { closeEndedOpenSessionsMutation } from '../use-cases/close-ended-open-sessions/shared/close-ended-open-sessions-mutation';
import { createSpaceMutation } from '../use-cases/create-space/shared/create-space-mutation';
import { endSpaceMutation } from '../use-cases/end-space/shared/end-space-mutation';
import { joinSpaceMutation } from '../use-cases/join-space/shared/join-space-mutation';
import { leaveSpaceMutation } from '../use-cases/leave-space/shared/leave-space-mutation';
import { markSpaceJoinAnnouncedMutation } from '../use-cases/mark-join-announced/shared/mark-join-announced-mutation';
import { removeSpaceUserMutation } from '../use-cases/remove-space-user/shared/remove-space-user-mutation';
import { renameSpaceMutation } from '../use-cases/rename-space/shared/rename-space-mutation';

export const SPACE_MUTATIONS = [
  createSpaceMutation,
  joinSpaceMutation,
  leaveSpaceMutation,
  endSpaceMutation,
  renameSpaceMutation,
  addSpaceUserMutation,
  removeSpaceUserMutation,
  markSpaceJoinAnnouncedMutation,
  closeEndedOpenSessionsMutation,
] as const;

export {
  addSpaceUserMutation,
  closeEndedOpenSessionsMutation,
  createSpaceMutation,
  endSpaceMutation,
  joinSpaceMutation,
  leaveSpaceMutation,
  markSpaceJoinAnnouncedMutation,
  removeSpaceUserMutation,
  renameSpaceMutation,
};
