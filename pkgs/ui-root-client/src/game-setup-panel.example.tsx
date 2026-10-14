import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from './example-root';
import { GameStatus } from './game-status';
import { ScreenExampleSetup } from './screen-example-game';

export default function GameSetupPanelExample(): JSX.Element {
  const [ready, setReady] = createSignal(false);
  return (
    <ExampleRoot>
      <ScreenExampleSetup onStart={() => setReady(true)} />
      <Show when={ready()}>
        <GameStatus live title="Ready to play" tone="success" />
      </Show>
    </ExampleRoot>
  );
}
