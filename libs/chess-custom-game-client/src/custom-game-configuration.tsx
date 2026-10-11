import { customGameStartable } from '@libs/chess-custom-game-shared/custom-game-state';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client/game-disclosure';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createSignal, type JSX, Show } from 'solid-js';
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
        <GameActionButton
          title={<Trans>Use this clock</Trans>}
          dataSet={{ testid: 'chess-custom-clock' }}
          operation={() =>
            props.model.choose({
              operation: 'clock',
              minutes: Number(minutes()),
              increment: Number(increment()),
            })
          }
        />
        <GameActionButton
          title={<Trans>Untimed</Trans>}
          dataSet={{ testid: 'chess-custom-untimed' }}
          operation={() => props.model.choose({ operation: 'untimed' })}
        />
        <GameActionButton
          title={<Trans>Swap colors</Trans>}
          dataSet={{ testid: 'chess-custom-swap' }}
          operation={() => props.model.choose({ operation: 'swap' })}
        />
      </div>
    </div>
  );
}

export function CustomGameConfiguration(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const startable = (): boolean => {
    const game = props.model.current();
    return game !== null && customGameStartable(game);
  };
  const ready = (): boolean => {
    const side = props.model.mySide();
    return side !== null && props.model.current()!.ready.includes(side);
  };
  return (
    <GameSection
      title={<Trans>Ready, set, play</Trans>}
      description={
        <Trans>Agree on the lineup and clock, then get ready.</Trans>
      }
    >
      <p
        class="text textBody"
        role="status"
        data-testid="chess-custom-startable"
      >
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
          <GameActionButton
            title={
              <Show when={ready()} fallback={<Trans>I'm ready</Trans>}>
                <Trans>Withdraw readiness</Trans>
              </Show>
            }
            dataSet={{ testid: 'chess-custom-ready' }}
            variant={ready() ? 'outline' : 'solid'}
            operation={() =>
              props.model.choose({ operation: ready() ? 'unready' : 'ready' })
            }
          />
        </Show>
        <Show when={props.model.canStart()}>
          <GameActionButton
            title={<Trans>Start game</Trans>}
            dataSet={{ testid: 'chess-custom-start' }}
            variant="solid"
            operation={() => props.model.choose({ operation: 'start' })}
            disabled={!startable()}
          />
        </Show>
      </div>
      <Show when={props.model.canConfigure()}>
        <GameDisclosure
          title={<Trans>Game options</Trans>}
          dataSet={{ testid: 'chess-custom-options' }}
        >
          <CustomGameTimeChoices model={props.model} />
        </GameDisclosure>
      </Show>
    </GameSection>
  );
}
