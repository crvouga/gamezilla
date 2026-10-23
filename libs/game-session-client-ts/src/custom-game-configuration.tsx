import { customGameStartable } from '@libs/game-session-shared-ts/custom-game-state';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
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
    <StackVertical gap="md">
      <TextInput
        label={<Trans>Minutes per side</Trans>}
        type="number"
        value={minutes()}
        onChangeText={setMinutes}
        dataSet={{ testid: 'custom-game-minutes' }}
      />
      <TextInput
        label={<Trans>Seconds added after a move</Trans>}
        type="number"
        value={increment()}
        onChangeText={setIncrement}
        dataSet={{ testid: 'custom-game-increment' }}
      />
      <GameActions>
        <GameActionButton
          title={<Trans>Use this clock</Trans>}
          dataSet={{ testid: 'custom-game-clock' }}
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
          dataSet={{ testid: 'custom-game-untimed' }}
          operation={() => props.model.choose({ operation: 'untimed' })}
        />
        <GameActionButton
          title={<Trans>Swap sides</Trans>}
          dataSet={{ testid: 'custom-game-swap' }}
          operation={() => props.model.choose({ operation: 'swap' })}
        />
      </GameActions>
    </StackVertical>
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
      title={<Trans>Start</Trans>}
      description={
        <Trans>Agree on the lineup and clock, then get ready.</Trans>
      }
    >
      <P variant="bodyBold" role="status" testId="custom-game-startable">
        <Show
          when={startable()}
          fallback={
            <Trans>Both sides must be filled and every person ready.</Trans>
          }
        >
          <Trans>Ready to start.</Trans>
        </Show>
      </P>
      <GameActions>
        <Show when={props.model.mySide() !== null && props.model.canJoin()}>
          <GameActionButton
            title={
              <Show when={ready()} fallback={<Trans>I'm ready</Trans>}>
                <Trans>Withdraw readiness</Trans>
              </Show>
            }
            dataSet={{ testid: 'custom-game-ready' }}
            variant={ready() ? 'outline' : 'solid'}
            disabled={
              !ready() &&
              props.model.privateSetup.has() &&
              !props.model.privateSetup.complete()
            }
            operation={() =>
              ready()
                ? props.model.choose({ operation: 'unready' })
                : props.model.ready()
            }
          />
        </Show>
        <Show when={props.model.canStart()}>
          <GameActionButton
            title={<Trans>Start game</Trans>}
            dataSet={{ testid: 'custom-game-start' }}
            variant="solid"
            operation={() => props.model.choose({ operation: 'start' })}
            disabled={!startable()}
          />
        </Show>
      </GameActions>
      <Show when={props.model.canConfigure()}>
        <GameDisclosure
          title={<Trans>Game options</Trans>}
          dataSet={{ testid: 'custom-game-options' }}
        >
          <CustomGameTimeChoices model={props.model} />
        </GameDisclosure>
      </Show>
    </GameSection>
  );
}
