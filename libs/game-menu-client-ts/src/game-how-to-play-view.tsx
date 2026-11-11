import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

/**
 * How a game is played, on a screen of its own behind the game's menu: the
 * game's name and its own words, at a reading measure. The host's Back
 * returns to the menu.
 */
export function GameHowToPlayView(props: {
  /** The game's name. */
  title: string;
  /** The game's own words on how it is played. */
  instructions: JSX.Element;
}): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="game-how-to-play"
      width="prose"
      title={<Trans>How to play {props.title}</Trans>}
      dataSet={{ testid: 'game-how-to-play' }}
    >
      <P variant="body">{props.instructions}</P>
    </EmbeddedScreen>
  );
}
