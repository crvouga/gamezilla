import { applyEnsuredUsernameMutation } from '../use-cases/apply-ensured-username/shared/apply-ensured-username-mutation';
import { claimUsernameMutation } from '../use-cases/claim-username/shared/claim-username-mutation';
import { ensureProfileMutation } from '../use-cases/ensure-profile/shared/ensure-profile-mutation';
import { patchAvatarMutation } from '../use-cases/patch-avatar/shared/patch-avatar-mutation';

export const PROFILE_MUTATIONS = [
  ensureProfileMutation,
  applyEnsuredUsernameMutation,
  claimUsernameMutation,
  patchAvatarMutation,
] as const;
