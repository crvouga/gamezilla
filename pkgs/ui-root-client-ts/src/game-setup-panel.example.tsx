import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from './example-root';
import { GameTurnPill } from './game-turn-pill';
import { ScreenExampleSetup } from './screen-example-game';

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
