import { Trans } from '@lingui/solid/macro';
import { Button, TextInput } from '@pkgs/ui';
import { createSignal, type JSX, Show } from 'solid-js';
import { customGameStartable } from '../../shared/custom-game/custom-game-state';
import { CustomGameAction } from './custom-game-action';
import type { CustomGameScreenModel } from './use-custom-game-screen';

function CustomGameTimeChoices(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const [minutes, setMinutes] = createSignal(
    String(props.model.current()?.minutes || 5)
  );
  const [increment, setIncrement] = createSignal(
    String(props.model.current()?.increment ?? 0)
  );
  return (
    <div class="box gap-3">
      <TextInput
        label={<Trans>Minutes per side</Trans>}
        type="number"
        value={minutes()}
        onChangeText={setMinutes}
        dataSet={{ testid: 'chess-custom-minutes' }}
      />
      <TextInput
        label={<Trans>Seconds added after a move</Trans>}
        type="number"
        value={increment()}
        onChangeText={setIncrement}
        dataSet={{ testid: 'chess-custom-increment' }}
      />
      <div class="box flex-row flex-wrap gap-2">
        <CustomGameAction
          title={<Trans>Use this clock</Trans>}
          testId="chess-custom-clock"
          operation={() =>
            props.model.choose({
              operation: 'clock',
              minutes: Number(minutes()),
              increment: Number(increment()),
            })
          }
        />
        <CustomGameAction
          title={<Trans>Untimed</Trans>}
          testId="chess-custom-untimed"
          operation={() => props.model.choose({ operation: 'untimed' })}
        />
        <CustomGameAction
          title={<Trans>Swap colors</Trans>}
          testId="chess-custom-swap"
          operation={() => props.model.choose({ operation: 'swap' })}
        />
      </div>
    </div>
  );
}

export function CustomGameConfiguration(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const [advanced, setAdvanced] = createSignal(false);
  const startable = (): boolean => {
    const game = props.model.current();
    return game !== null && customGameStartable(game);
  };
  const ready = (): boolean => {
    const side = props.model.mySide();
    return side !== null && props.model.current()!.ready.includes(side);
  };
  return (
    <div class="box gap-3">
      <p class="text" role="status" data-testid="chess-custom-startable">
        <Show
          when={startable()}
          fallback={
            <Trans>Both sides must be filled and every person ready.</Trans>
          }
        >
          <Trans>Ready to start.</Trans>
        </Show>
      </p>
      <div class="box flex-row gap-2 flex-wrap">
        <Show when={props.model.mySide() !== null && props.model.canJoin()}>
          <CustomGameAction
            title={
              <Show when={ready()} fallback={<Trans>I'm ready</Trans>}>
                <Trans>Withdraw readiness</Trans>
              </Show>
            }
            testId="chess-custom-ready"
            operation={() =>
              props.model.choose({ operation: ready() ? 'unready' : 'ready' })
            }
          />
        </Show>
        <Show when={props.model.canStart()}>
          <CustomGameAction
            title={<Trans>Start game</Trans>}
            testId="chess-custom-start"
            operation={() => props.model.choose({ operation: 'start' })}
            disabled={!startable()}
          />
        </Show>
        <Show when={props.model.canConfigure()}>
          <Button
            title={<Trans>Game options</Trans>}
            variant="ghost"
            onClick={() => setAdvanced(!advanced())}
            dataSet={{ testid: 'chess-custom-options' }}
          />
        </Show>
      </div>
      <Show when={advanced() && props.model.canConfigure()}>
        <CustomGameTimeChoices model={props.model} />
      </Show>
    </div>
  );
}
