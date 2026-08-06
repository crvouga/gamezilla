import { AUTH_MUTATIONS } from '@libs/auth/shared/mutations/auth-mutations';
import { CHESS_MUTATIONS } from '@libs/chess/shared/mutations/chess-mutations';
import { FRIENDS_MUTATIONS } from '@libs/friends/shared/mutations/friends-mutations';
import { PROFILE_MUTATIONS } from '@libs/profile/shared/mutations/profile-mutations';
import { SPACE_MUTATIONS } from '@libs/spaces/shared/mutations/space-mutations';
import { registry } from '@pkgs/mutations/core/registry';
import { FRAMEWORK_MUTATIONS } from '@pkgs/mutations/shared/acknowledge-write-rejection';

export const APP_MUTATIONS = registry([
  ...FRAMEWORK_MUTATIONS,
  ...AUTH_MUTATIONS,
  ...CHESS_MUTATIONS,
  ...FRIENDS_MUTATIONS,
  ...PROFILE_MUTATIONS,
  ...SPACE_MUTATIONS,
]);
