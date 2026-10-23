import { addSpaceUserMutation } from './add-space-user-mutation';
import { closeEndedOpenSessionsMutation } from './close-ended-open-sessions-mutation';
import { createSpaceMutation } from './create-space-mutation';
import { endSpaceMutation } from './end-space-mutation';
import { joinSpaceMutation } from './join-space-mutation';
import { leaveSpaceMutation } from './leave-space-mutation';
import { markSpaceJoinAnnouncedMutation } from './mark-join-announced-mutation';
import { removeSpaceUserMutation } from './remove-space-user-mutation';
import { renameSpaceMutation } from './rename-space-mutation';

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
