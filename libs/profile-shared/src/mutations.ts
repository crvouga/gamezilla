import { applyEnsuredUsernameMutation } from './apply-ensured-username-mutation';
import { claimUsernameMutation } from './claim-username-mutation';
import { ensureProfileMutation } from './ensure-profile-mutation';
import { patchAvatarMutation } from './patch-avatar-mutation';

export const PROFILE_MUTATIONS = [
  ensureProfileMutation,
  applyEnsuredUsernameMutation,
  claimUsernameMutation,
  patchAvatarMutation,
] as const;
