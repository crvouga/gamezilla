import { AUTH_MUTATIONS } from '@libs/auth/root/mutations';
import { CHESS_MUTATIONS } from '@libs/chess/root/mutations';
import { FRIENDS_MUTATIONS } from '@libs/friends/root/mutations';
import { PROFILE_MUTATIONS } from '@libs/profile/root/mutations';
import { SPACE_MUTATIONS } from '@libs/spaces/root/mutations';
import { mutationRegistry } from '@pkgs/sync-engine/shared';

/** Product mutations only — framework mutations are merged by createLocalSyncEngine / MutationClientProvider. */
export const APP_MUTATIONS = mutationRegistry([
  ...AUTH_MUTATIONS,
  ...CHESS_MUTATIONS,
  ...FRIENDS_MUTATIONS,
  ...PROFILE_MUTATIONS,
  ...SPACE_MUTATIONS,
]);
