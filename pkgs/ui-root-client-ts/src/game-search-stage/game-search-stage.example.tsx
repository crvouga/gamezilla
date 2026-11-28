import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  GameLobbyDock,
  GameLobbyScreen,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSearchStage } from '@pkgs/ui-root-client-ts/game-search-stage';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export type GameSearchStageExampleProps = {
  /** The person chose a clock: its words show on their seat. */
  timed: boolean;
  /** No connection: a still mark and the offline words. */
  offline: boolean;
  onStop: () => void;
};

/** A search under way: the stage where the board will be, and Stop in the dock. */
export default function GameSearchStageExample(
  props: GameSearchStageExampleProps
): JSX.Element {
  return (
    <ExampleRoot bounded>
      <GameLobbyScreen
        screenId="example-search"
        dock={
          <GameLobbyDock>
            <Button
              title="Stop"
              size="lg"
              fullWidth
              disabled={props.offline}
              onClick={() => props.onStop()}
              dataSet={{ testid: 'example-stop' }}
            />
          </GameLobbyDock>
        }
      >
        <GameModeCard eyebrow="Ranked match · Rated" title="Connect Four" />
        <GameSearchStage
          motif="discs"
          title={props.offline ? "You're offline" : 'Searching…'}
          description={
            props.offline
              ? 'Your search is still open. Reconnect to see its progress or stop it.'
              : 'Looking for a 5+3 Connect Four opponent.'
          }
          elapsed={props.offline ? 'Searched 42 seconds' : '42 seconds'}
          mark={
            props.offline ? (
              <WifiOffIcon size={24} color="warning" />
            ) : undefined
          }
          seat={
            <GamePlayerBar
              avatar={<Avatar kind="person" />}
              name="River"
              trailing={
                <Show when={props.timed}>
                  <Badge intent="neutral" label="5 min + 3 sec" />
                </Show>
              }
              dataSet={{ testid: 'example-search-seat' }}
            />
          }
        />
      </GameLobbyScreen>
    </ExampleRoot>
  );
}
