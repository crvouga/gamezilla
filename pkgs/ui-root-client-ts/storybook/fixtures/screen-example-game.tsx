import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { createSignal, For, type JSX } from 'solid-js';

/** Illustrative play surface; no game implementation or product dependency. */
export function ScreenExampleBoard(): JSX.Element {
  const [selected, setSelected] = createSignal<number[]>([]);
  return (
    <div
      class="grid grid-cols-3 gap-2 p-4 bg-surface-muted"
      role="group"
      aria-label="Example board"
    >
      <For each={Array.from({ length: 9 }, (_, i) => i)}>
        {(index) => (
          <Button
            title={String(index + 1)}
            aria-label={`Position ${index + 1}`}
            aria-pressed={selected().includes(index)}
            intent={selected().includes(index) ? 'primary' : 'neutral'}
            variant={selected().includes(index) ? 'solid' : 'outline'}
            onClick={() =>
              setSelected((old) =>
                old.includes(index)
                  ? old.filter((v) => v !== index)
                  : [...old, index]
              )
            }
          />
        )}
      </For>
    </div>
  );
}

export function ScreenExampleStage(): JSX.Element {
  return (
    <GameBoardStage
      others={<GamePlayerBar name="Robin" />}
      own={<GamePlayerBar name="Alex" active />}
    >
      <ScreenExampleBoard />
    </GameBoardStage>
  );
}

export function ScreenExampleSetup(props: {
  onStart: () => void;
  label?: string;
}): JSX.Element {
  const [pace, setPace] = createSignal('relaxed');
  return (
    <GameSetupPanel
      title="Set up a round"
      description="Choose your pace before you play."
      actions={
        <Button title={props.label ?? 'Start round'} onClick={props.onStart} />
      }
    >
      <GameChoiceGrid
        label="Pace"
        value={pace()}
        onChange={setPace}
        choices={[
          { value: 'quick', title: 'Quick', detail: '2 minutes' },
          { value: 'relaxed', title: 'Relaxed', detail: '5 minutes' },
          { value: 'untimed', title: 'Untimed', detail: 'No clock' },
        ]}
      />
    </GameSetupPanel>
  );
}
