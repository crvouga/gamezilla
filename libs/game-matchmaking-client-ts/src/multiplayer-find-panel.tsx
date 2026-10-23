import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { createSignal, type JSX, Show } from 'solid-js';
import { SpeedName } from './speed-name';
import { timeControlChoiceText } from './time-control-name';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

/** Choose one of the offered time controls, then find an opponent at it. */
export function MultiplayerFindPanel(props: {
  readonly controls: MultiplayerControlsModel;
  readonly gameId: string;
}): JSX.Element {
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  const rules = useTurnGames();
  const count = () => gameSides(rules.byId(props.gameId)).length;
  return (
    <GameSetupPanel
      title={<Trans>New game</Trans>}
      description={
        <>
          <Show when={count() > 2}>
            <Trans>
              A game needs {count()} players including you. Find {count() - 1}{' '}
              other players at the same clock choice.
            </Trans>{' '}
          </Show>
          <Trans>
            Minutes per player + seconds added after each move, or days for
            every move in a daily game.
          </Trans>
        </>
      }
      actions={
        <GameActionButton
          title={
            <Show when={count() > 2} fallback={<Trans>Find an opponent</Trans>}>
              <Trans>Find players</Trans>
            </Show>
          }
          successLabel={
            <Show
              when={count() > 2}
              fallback={<Trans>Opponent search accepted</Trans>}
            >
              <Trans>Player search accepted</Trans>
            </Show>
          }
          operation={() => props.controls.begin(timeControl())}
          variant="solid"
          fullWidth
          dataSet={{ testid: 'multiplayer-find' }}
        />
      }
    >
      <GameChoiceGrid
        label={<Trans>Time control</Trans>}
        value={timeControl()}
        onChange={setTimeControl}
        choices={TIME_CONTROLS.map((control) => ({
          value: control.id,
          title: timeControlChoiceText(control.id),
          detail: <SpeedName speed={control.speed} />,
          dataSet: {
            testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
          },
        }))}
      />
    </GameSetupPanel>
  );
}
