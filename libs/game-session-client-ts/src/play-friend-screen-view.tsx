import type { JSX } from '@solidjs/web';
import type { GameSessionScreenViewProps } from './game-session-screen-view';
import { FriendSetup } from './play-friend-setup-pages';
import { PlayFriendStagePlace } from './play-friend-stage-view';
import { SessionScreenView } from './session-screen-view';

export function PlayFriendScreenView(
  props: GameSessionScreenViewProps
): JSX.Element {
  return (
    <SessionScreenView
      {...props}
      mode="vs-human"
      Setup={FriendSetup}
      Stage={PlayFriendStagePlace}
    />
  );
}
