import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';
import { type PlayScreenProps, WiredPlayScreen } from './game-session-screen';

/** Play Bots in a space: the other seats are bots. */
export function PlayBotsScreen(props: PlayScreenProps): JSX.Element {
  return (
    <WiredPlayScreen
      {...props}
      mode="vs-bot"
      fallbackTitle={<Trans>Play Bots</Trans>}
    />
  );
}
