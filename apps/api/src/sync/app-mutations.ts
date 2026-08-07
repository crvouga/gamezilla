import { AUTH_MUTATIONS } from '@libs/auth/shared/mutations/auth-mutations';
import { CHESS_MUTATIONS } from '@libs/chess/shared/mutations/chess-mutations';
import { FRIENDS_MUTATIONS } from '@libs/friends/shared/mutations/friends-mutations';
import { PROFILE_MUTATIONS } from '@libs/profile/shared/mutations/profile-mutations';
import { SPACE_MUTATIONS } from '@libs/spaces/shared/mutations/space-mutations';
import { registry } from '@pkgs/sync-engine/mutations/core/registry';

/** Product mutations only — framework mutations are merged by createSyncApp / createLocalSyncEngine. */
export const APP_MUTATIONS = registry([
  ...AUTH_MUTATIONS,
  ...CHESS_MUTATIONS,
  ...FRIENDS_MUTATIONS,
  ...PROFILE_MUTATIONS,
  ...SPACE_MUTATIONS,
]);
