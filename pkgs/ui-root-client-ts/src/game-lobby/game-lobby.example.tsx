import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  GameLobbyDock,
  GameLobbyScreen,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export type GameLobbyExampleProps = {
  /** How many people sit in the lobby. */
  players: number;
  /** Whether the person has said they are ready. */
  ready: boolean;
  /** A lobby with a line on how the game is won. */
  summary: boolean;
  onReady: () => void;
  onLeave: () => void;
};

const NAMES = ['River', 'Atlas', 'Juniper', 'Sol', 'Wren', 'Indigo', 'Marlow'];

/** A lobby: what is played, who is in, and the one command under the thumb. */
export default function GameLobbyExample(
  props: GameLobbyExampleProps
): JSX.Element {
  return (
    <ExampleRoot bounded>
      <GameLobbyScreen
        screenId="example-lobby"
        dock={
          <GameLobbyDock
            status={
              props.ready ? 'Waiting for the host.' : 'Ready when you are.'
            }
          >
            <Button
              title={props.ready ? "I'm not ready" : "I'm ready"}
              variant={props.ready ? 'outline' : 'solid'}
              size="lg"
              fullWidth
              onClick={() => props.onReady()}
            />
            <Button
              title="Leave"
              variant="ghost"
              intent="neutral"
              fullWidth
              onClick={() => props.onLeave()}
            />
          </GameLobbyDock>
        }
      >
        <GameModeCard
          eyebrow="Custom game"
          title="Connect Four"
          summary={
            <Show when={props.summary}>
              Line up four discs in a row before your opponent does.
            </Show>
          }
          facts={[
            { id: 'players', label: 'Players', value: props.players },
            { id: 'clock', label: 'Clock', value: '5 min' },
            { id: 'rating', label: 'Rating', value: 'Unrated' },
          ]}
        />
        <MenuSection title="Players">
          <For each={NAMES.slice(0, props.players)}>
            {(name) => <MenuRow title={name} />}
          </For>
        </MenuSection>
      </GameLobbyScreen>
    </ExampleRoot>
  );
}
