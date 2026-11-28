import type { JSX } from '@solidjs/web';
import type { GameSessionScreenViewProps } from './game-session-screen-view';
import { BotSetup } from './play-bots-setup-pages';
import { PlayBotsStagePlace } from './play-bots-stage-view';
import { SessionScreenView } from './session-screen-view';

export function PlayBotsScreenView(
  props: GameSessionScreenViewProps
): JSX.Element {
  return (
    <SessionScreenView
      {...props}
      mode="vs-bot"
      Setup={BotSetup}
      Stage={PlayBotsStagePlace}
    />
  );
}
