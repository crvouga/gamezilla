import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX, Show } from 'solid-js';
import { GameFrameOptions } from './game-frame-options';
import { frameStartLine } from './game-frame-setup-copy';
import type { FrameOptions, FrameStart } from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

/** Before any game: create one, or play the bots at once. */
export function FrameStarterView(props: {
  readonly canCreate: boolean;
  readonly playerCount: number;
  readonly onChoose: Choose;
  readonly onPlayBot: () => Promise<void>;
}): JSX.Element {
  return (
    <GameSetupPanel
      title={<Trans>New game</Trans>}
      description={
        <Trans>
          Choose who plays each side. Anyone in this space can watch.
        </Trans>
      }
    >
      <Show
        when={props.canCreate}
        fallback={
          <P variant="caption" tone="secondary">
            <Trans>Waiting for the creator to create a game.</Trans>
          </P>
        }
      >
        <GameActions>
          <GameActionButton
            title={<Trans>Create game</Trans>}
            dataSet={{ testid: 'custom-game-create' }}
            variant="solid"
            operation={() => props.onChoose({ operation: 'create' })}
          />
          <GameActionButton
            title={
              <Show
                when={props.playerCount > 2}
                fallback={<Trans>Play a bot</Trans>}
              >
                <Trans>Play against bots</Trans>
              </Show>
            }
            dataSet={{ testid: 'custom-game-play-bot' }}
            operation={() => props.onPlayBot()}
          />
        </GameActions>
      </Show>
    </GameSetupPanel>
  );
}

/**
 * The person's own private setup while the custom game is set up: the
 * game's own setup board (`board`), a random setup, and whether it is
 * complete. It locks while they are ready.
 */
export function FramePrivateSetupView(props: {
  readonly complete: boolean;
  readonly locked: boolean;
  readonly board: JSX.Element;
  readonly onRandom: () => Promise<void>;
}): JSX.Element {
  return (
    <GameSection
      title={<Trans>Your private setup</Trans>}
      description={
        <Trans>Only you see it. Get ready once it is complete.</Trans>
      }
    >
      {props.board}
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
      <GameActions>
        <GameActionButton
          title={<Trans>Random setup</Trans>}
          dataSet={{ testid: 'custom-game-setup-random' }}
          disabled={props.locked}
          operation={() => props.onRandom()}
        />
      </GameActions>
    </GameSection>
  );
}

/** The clock, which the platform owns for every game played by turns. */
function FrameTimeChoicesView(props: {
  readonly clock: NonNullable<FrameOptions['clock']>;
  readonly onChoose: Choose;
}): JSX.Element {
  const [minutes, setMinutes] = createSignal(String(props.clock.minutes || 5));
  const [increment, setIncrement] = createSignal(String(props.clock.increment));
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
            props.onChoose({
              operation: 'clock',
              minutes: Number(minutes()),
              increment: Number(increment()),
            })
          }
        />
        <GameActionButton
          title={<Trans>Untimed</Trans>}
          dataSet={{ testid: 'custom-game-untimed' }}
          operation={() => props.onChoose({ operation: 'untimed' })}
        />
        <GameActionButton
          title={<Trans>Swap sides</Trans>}
          dataSet={{ testid: 'custom-game-swap' }}
          operation={() => props.onChoose({ operation: 'swap' })}
        />
      </GameActions>
    </StackVertical>
  );
}

/**
 * The game's options: its player count (shown, not changed: each count is
 * its own game), its own options from its frame (the host changes them,
 * everyone else reads them) and, for a host of a game played by turns, the
 * clock behind its disclosure.
 */
export function FrameOptionsView(props: {
  readonly options: FrameOptions;
  readonly onChoose: Choose;
}): JSX.Element {
  return (
    <GameSection title={<Trans>Options</Trans>}>
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
      <Show when={props.options.clock}>
        {(clock) => (
          <GameDisclosure
            title={<Trans>Clock and sides</Trans>}
            dataSet={{ testid: 'custom-game-options' }}
          >
            <FrameTimeChoicesView clock={clock()} onChoose={props.onChoose} />
          </GameDisclosure>
        )}
      </Show>
    </GameSection>
  );
}

/**
 * Starting the game, right under the players it starts with: why it cannot
 * start yet (or "Ready to start."), then Start, full width, for whoever may
 * start it, always shown and held back until the game can start. The
 * person's own readiness follows: the one thing to do next when they may
 * not start the game, a quiet second choice when they may.
 */
export function FrameStartView(props: {
  readonly start: FrameStart;
  readonly onChoose: Choose;
  readonly onReady: () => Promise<void>;
}): JSX.Element {
  return (
    <StackVertical gap="sm">
      <P variant="body" role="status" testId="custom-game-startable">
        {frameStartLine(props.start.reason)}
      </P>
      <Show when={props.start.hostStarts}>
        <P variant="caption" tone="secondary" testId="custom-game-host-starts">
          <Trans>Waiting for the host to start.</Trans>
        </P>
      </Show>
      <Show when={props.start.canStart}>
        <GameActionButton
          title={<Trans>Start game</Trans>}
          dataSet={{ testid: 'custom-game-start' }}
          variant="solid"
          fullWidth
          operation={() => props.onChoose({ operation: 'start' })}
          disabled={props.start.reason !== null}
        />
      </Show>
      <Show when={props.start.readiness}>
        {(readiness) => (
          <GameActionButton
            title={
              <Show
                when={readiness().ready}
                fallback={<Trans>I'm ready</Trans>}
              >
                <Trans>I'm not ready</Trans>
              </Show>
            }
            dataSet={{ testid: 'custom-game-ready' }}
            variant={readinessVariant(props.start, readiness().ready)}
            fullWidth
            disabled={!readiness().ready && readiness().blocked}
            operation={() =>
              readiness().ready
                ? props.onChoose({ operation: 'unready' })
                : props.onReady()
            }
          />
        )}
      </Show>
    </StackVertical>
  );
}

/**
 * Getting ready is the next step until the person is ready; once ready, or
 * beside Start, taking it back is a quiet choice.
 */
function readinessVariant(
  start: FrameStart,
  ready: boolean
): 'solid' | 'outline' | 'ghost' {
  if (start.canStart) return 'ghost';
  return ready ? 'outline' : 'solid';
}
