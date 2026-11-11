import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameLobbyDock } from '@pkgs/ui-root-client-ts/game-lobby';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ScreenIntro } from '@pkgs/ui-root-client-ts/screen-intro';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { createFrameChoices, FrameChoiceRow } from './game-frame-choice';
import { GameFrameOptions } from './game-frame-options';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FrameLobbyPage, FramePlacePage } from './game-frame-shell';
import type { FrameOptions } from './game-frame-view-types';

type Props = FramePlaceProps;

/**
 * The game's own options: its player count (shown, not changed: each count
 * is its own game) and the options its frame declares. The host changes
 * them, each change sent as it is made; everyone else reads them.
 */
export function FrameOptionsPlace(
  props: Props & { readonly options: FrameOptions }
): JSX.Element {
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-options"
      title={<Trans>Options</Trans>}
      subtitle={
        <Show
          when={props.options.editable}
          fallback={<Trans>The host chooses these.</Trans>}
        >
          <Trans>Each change is saved as you make it.</Trans>
        </Show>
      }
    >
      <StackVertical gap="lg">
        <Show when={props.options.players}>
          {(players) => (
            <GameOptionField
              kind="count"
              label={t`Players`}
              readOnly
              value={players().count}
              min={players().min}
              max={players().max}
              onChange={() => undefined}
              dataSet={{ testid: 'custom-game-players' }}
            />
          )}
        </Show>
        <GameFrameOptions
          options={props.options.groups}
          position={props.options.position}
          editable={props.options.editable}
          apply={(choice) => props.onChoose({ operation: 'rules', choice })}
        />
      </StackVertical>
    </FramePlacePage>
  );
}

/**
 * The clock, which the platform owns for every game played by turns: set
 * minutes and added seconds and use them, or play untimed. Swapping who
 * plays which side is agreed here too. Each returns to the lobby.
 */
export function FrameClockPlace(
  props: Props & { readonly clock: NonNullable<FrameOptions['clock']> }
): JSX.Element {
  const [minutes, setMinutes] = createSignal(String(props.clock.minutes || 5));
  const [increment, setIncrement] = createSignal(String(props.clock.increment));
  const choices = createFrameChoices(() => props.onClose());
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-clock"
      title={<Trans>Clock and sides</Trans>}
      subtitle={
        <Show
          when={props.clock.minutes > 0}
          fallback={<Trans>This game is untimed.</Trans>}
        >
          <Trans>
            Each side has {props.clock.minutes} minutes, plus{' '}
            {props.clock.increment} seconds a move.
          </Trans>
        </Show>
      }
    >
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
        <GameActions sizing="share">
          <GameActionButton
            title={<Trans>Use this clock</Trans>}
            variant="solid"
            dataSet={{ testid: 'custom-game-clock' }}
            operation={async () => {
              await props.onChoose({
                operation: 'clock',
                minutes: Number(minutes()),
                increment: Number(increment()),
              });
              props.onClose();
            }}
          />
        </GameActions>
      </StackVertical>
      <MenuSection>
        <FrameChoiceRow
          choices={choices}
          id="custom-game-untimed"
          title={<Trans>Play untimed</Trans>}
          selected={props.clock.minutes === 0}
          operation={() => props.onChoose({ operation: 'untimed' })}
        />
        <FrameChoiceRow
          choices={choices}
          id="custom-game-swap"
          title={<Trans>Swap sides</Trans>}
          caption={<Trans>Everyone moves to the next side</Trans>}
          operation={() => props.onChoose({ operation: 'swap' })}
        />
      </MenuSection>
    </FramePlacePage>
  );
}

/** Where the setup stands, and what getting ready still needs. */
function PrivateSetupStatus(props: {
  readonly complete: boolean;
  readonly ready: boolean;
}): JSX.Element {
  return (
    <>
      <P
        variant="bodyBold"
        role="status"
        dataSet={{ testid: 'custom-game-setup-status' }}
      >
        <Show
          when={props.complete}
          fallback={<Trans>Your private setup is incomplete.</Trans>}
        >
          <Trans>Your private setup is complete.</Trans>
        </Show>
      </P>
      <P variant="caption" tone="secondary" testId="custom-game-setup-hint">
        <Switch
          fallback={
            <Trans>
              Place every piece on the board, or take a random setup. Then you
              can get ready.
            </Trans>
          }
        >
          <Match when={props.ready}>
            <Trans>It is locked while you are ready.</Trans>
          </Match>
          <Match when={props.complete}>
            <Trans>You can still move pieces until you are ready.</Trans>
          </Match>
        </Switch>
      </P>
    </>
  );
}

/**
 * The person's own private setup: the game's own setup board, and under
 * it, in a dock that never scrolls, whether it is complete, what getting
 * ready still needs, getting ready with it and a random setup. It locks
 * while they are ready or offline.
 */
export function FramePrivateSetupPlace(
  props: Props & {
    readonly own: { readonly complete: boolean; readonly locked: boolean };
  }
): JSX.Element {
  const ready = (): boolean => props.setup?.start.readiness?.ready === true;
  return (
    <FrameLobbyPage
      {...props}
      screenId="custom-game-private-setup"
      dock={
        <GameLobbyDock
          status={
            <PrivateSetupStatus complete={props.own.complete} ready={ready()} />
          }
        >
          <Show when={props.setup?.start.readiness}>
            {(readiness) => (
              <GameActionButton
                title={
                  <Show when={ready()} fallback={<Trans>I'm ready</Trans>}>
                    <Trans>I'm not ready</Trans>
                  </Show>
                }
                variant={ready() ? 'outline' : 'solid'}
                size="lg"
                dataSet={{ testid: 'custom-game-ready' }}
                disabled={!ready() && readiness().blocked}
                operation={async () => {
                  if (ready()) {
                    await props.onChoose({ operation: 'unready' });
                    return;
                  }
                  await props.onReady();
                  props.onClose();
                }}
              />
            )}
          </Show>
          <GameActionButton
            title={<Trans>Random setup</Trans>}
            size="lg"
            dataSet={{ testid: 'custom-game-setup-random' }}
            disabled={props.own.locked}
            operation={() => props.onRandomSetup()}
          />
        </GameLobbyDock>
      }
    >
      <ScreenIntro
        title={<Trans>Your private setup</Trans>}
        subtitle={<Trans>Only you see it.</Trans>}
      />
      {props.setupBoard}
    </FrameLobbyPage>
  );
}
