import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ScreenExampleSetup } from '../../storybook/fixtures/screen-example-game';

export default function GameSetupPanelExample(): JSX.Element {
  const [ready, setReady] = createSignal(false);
  return (
    <ExampleRoot>
      <ScreenExampleSetup onStart={() => setReady(true)} />
      <Show when={ready()}>
        <GameTurnPill live title="Ready to play" tone="success" />
      </Show>
    </ExampleRoot>
  );
}
