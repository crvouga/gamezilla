import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';
import { type PlayScreenProps, WiredPlayScreen } from './game-session-screen';

/** Play Friend in a space: people, invitations, and open seats. */
export function PlayFriendScreen(props: PlayScreenProps): JSX.Element {
  return (
    <WiredPlayScreen
      {...props}
      mode="vs-human"
      fallbackTitle={<Trans>Play Friend</Trans>}
    />
  );
}
