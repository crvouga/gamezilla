import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
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
      back={<Trans>Back to setup</Trans>}
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
      <StackVertical gap="md">
        {/* The count is read here, its note right under it; the seats in
            setup change it. */}
        <Show when={props.options.players}>
          {(players) => (
            <StackVertical gap="none">
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
              <P variant="caption" tone="secondary">
                <Trans>Players are set by the seats in setup.</Trans>
              </P>
            </StackVertical>
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
 * A time for each side, saved as each field is left (a time is set by its
 * two fields together, so not at every keystroke).
 */
function ClockTimeFields(props: {
  readonly minutes: string;
  readonly increment: string;
  readonly onMinutes: (value: string) => void;
  readonly onIncrement: (value: string) => void;
  readonly onSave: () => void;
}): JSX.Element {
  return (
    <StackVertical gap="md">
      <TextInput
        label={<Trans>Minutes per side</Trans>}
        type="number"
        value={props.minutes}
        onChangeText={props.onMinutes}
        onChange={props.onSave}
        dataSet={{ testid: 'custom-game-minutes' }}
      />
      <TextInput
        label={<Trans>Seconds added after a move</Trans>}
        type="number"
        value={props.increment}
        onChangeText={props.onIncrement}
        onChange={props.onSave}
        dataSet={{ testid: 'custom-game-increment' }}
      />
      <P variant="caption" tone="secondary">
        <Trans>Each time is saved as you leave its field.</Trans>
      </P>
    </StackVertical>
  );
}

/**
 * The clock, which the platform owns for every game played by turns: set
 * minutes and added seconds (saved as they are left), or play untimed. Swapping who
 * plays which side is agreed here too. Each returns to the lobby.
 */
export function FrameClockPlace(
  props: Props & { readonly clock: NonNullable<FrameOptions['clock']> }
): JSX.Element {
  const [minutes, setMinutes] = createSignal(String(props.clock.minutes || 5));
  const [increment, setIncrement] = createSignal(String(props.clock.increment));
  const choices = createFrameChoices(() => props.onClose());
  // A time is saved as its field is left, and on the way back too, so
  // leaving never drops an edit.
  const edited = (): boolean =>
    props.clock.minutes > 0 &&
    Number(minutes()) > 0 &&
    (Number(minutes()) !== props.clock.minutes ||
      Number(increment()) !== props.clock.increment);
  const save = (): Promise<void> =>
    edited()
      ? props.onChoose({
          operation: 'clock',
          minutes: Number(minutes()),
          increment: Number(increment()),
        })
      : Promise.resolve();
  return (
    <FramePlacePage
      {...props}
      onClose={() => void save().then(() => props.onClose())}
      screenId="custom-game-clock"
      back={<Trans>Back to setup</Trans>}
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
      {/* The clock first: none, or the same time for each side; then the
          sides, apart, since changing them is not a clock setting. */}
      <MenuSection title={<Trans>Clock</Trans>}>
        <FrameChoiceRow
          choices={choices}
          id="custom-game-untimed"
          title={<Trans>Play untimed</Trans>}
          caption={<Trans>No clock for either side</Trans>}
          selected={props.clock.minutes === 0}
          operation={() => props.onChoose({ operation: 'untimed' })}
        />
        <FrameChoiceRow
          choices={choices}
          id="custom-game-timed"
          title={<Trans>Timed</Trans>}
          caption={
            <Trans>
              {minutes()} minutes a side, plus {increment()} seconds a move
            </Trans>
          }
          selected={props.clock.minutes > 0}
          operation={() =>
            props.onChoose({
              operation: 'clock',
              minutes: Number(minutes()),
              increment: Number(increment()),
            })
          }
        />
      </MenuSection>
      <ClockTimeFields
        minutes={minutes()}
        increment={increment()}
        onMinutes={setMinutes}
        onIncrement={setIncrement}
        onSave={() => void save()}
      />
      <MenuSection title={<Trans>Sides</Trans>}>
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
          {/* The way back sits in the dock beside the random setup, so the
              footer never hides it. */}
          <GameActions sizing="fill">
            <GameActionButton
              title={<Trans>Random setup</Trans>}
              size="lg"
              dataSet={{ testid: 'custom-game-setup-random' }}
              disabled={props.own.locked}
              operation={() => props.onRandomSetup()}
            />
            <Button
              title={<Trans>Back to setup</Trans>}
              variant="outline"
              intent="neutral"
              size="lg"
              onClick={() => props.onClose()}
              dataSet={{ testid: 'custom-game-place-back' }}
            />
          </GameActions>
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
