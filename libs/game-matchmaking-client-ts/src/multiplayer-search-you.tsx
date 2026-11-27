import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { GAME_PLAYER_AVATAR_SIZE } from '@pkgs/ui-root-client-ts/game-player-bar';
import type { MultiplayerSearchYou } from './multiplayer-waiting';

/**
 * The person's own face and name for the seat under the waiting board,
 * built once so the seat never draws either twice.
 */
export function searchYou(profileId: () => string): MultiplayerSearchYou {
  return {
    avatar: (
      <UserProfileAvatar
        profileId={profileId()}
        size={GAME_PLAYER_AVATAR_SIZE}
      />
    ),
    name: <UserUsername profileId={profileId()} withAt={false} />,
  };
}
