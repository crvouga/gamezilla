import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { GameFrameOptions } from './game-frame-options';
import { frameStartLine } from './game-frame-setup-copy';
import { frameStartReason } from './game-frame-start-reason';
import { useFrameViewer } from './game-frame-viewer';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type ModelProps = { model: CustomGameScreenModel };

/** The clock, which the platform owns for every game played by turns. */
function CustomGameTimeChoices(props: ModelProps): JSX.Element {
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

/**
 * How many people the game seats, for a game offered for several counts.
 * Shown, not changed here: each count is its own game, chosen from the
 * game's menu.
 */
function CustomGamePlayerCount(props: ModelProps): JSX.Element {
  const presentation = useGamePresentation();
  const players = () => presentation(props.model.current()!.fen).frame.players;
  const count = (): number => props.model.current()!.sides.length;
  return (
    <Show when={players().min < players().max}>
      <GameOptionField
        kind="count"
        label={t`Players`}
        readOnly
        value={count()}
        min={players().min}
        max={players().max}
        onChange={() => undefined}
        dataSet={{ testid: 'custom-game-players' }}
      />
    </Show>
  );
}

/**
 * The game's options: its player count, its own options from its frame
 * (the host changes them, everyone else reads them) and, for a game played
 * by turns, the clock behind its disclosure for the host.
 */
function CustomGameOptions(props: ModelProps): JSX.Element {
  const presentation = useGamePresentation();
  const rules = useTurnGames();
  const position = () => props.model.current()!.fen;
  const frame = () => presentation(position()).frame;
  const players = () => frame().players;
  const turns = () => rules.turnsForPosition(position()) !== undefined;
  const clock = () => turns() && props.model.canConfigure();
  return (
    <Show
      when={
        frame().options.length > 0 || players().min < players().max || clock()
      }
    >
      <GameSection title={<Trans>Options</Trans>}>
        <CustomGamePlayerCount model={props.model} />
        <GameFrameOptions
          options={frame().options}
          position={position()}
          editable={props.model.canConfigure()}
          apply={(choice) => props.model.choose({ operation: 'rules', choice })}
        />
        <Show when={clock()}>
          <GameDisclosure
            title={<Trans>Clock and sides</Trans>}
            dataSet={{ testid: 'custom-game-options' }}
          >
            <CustomGameTimeChoices model={props.model} />
          </GameDisclosure>
        </Show>
      </GameSection>
    </Show>
  );
}

/**
 * Starting the game: why it cannot start yet (or "Ready to start."), the
 * person's own readiness, and Start for whoever may start it, always shown
 * and held back until the game can start.
 */
function CustomGameStart(props: ModelProps): JSX.Element {
  const viewer = useFrameViewer(props.model);
  const reason = createMemo(() => frameStartReason(props.model.current()!));
  const ready = (): boolean => {
    const side = props.model.mySide();
    return side !== null && props.model.current()!.ready.includes(side);
  };
  return (
    <GameSection
      title={<Trans>Start</Trans>}
      description={
        <Trans>Agree on the lineup and options, then get ready.</Trans>
      }
    >
      <P variant="bodyBold" role="status" testId="custom-game-startable">
        {frameStartLine(reason())}
      </P>
      <Show when={viewer.role() === 'seated' && !props.model.canStart()}>
        <P variant="caption" tone="secondary" testId="custom-game-host-starts">
          <Trans>Waiting for the host to start.</Trans>
        </P>
      </Show>
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
            disabled={reason() !== null}
          />
        </Show>
      </GameActions>
    </GameSection>
  );
}

/** The custom game's options and its start, while it is set up. */
export function CustomGameConfiguration(props: ModelProps): JSX.Element {
  return (
    <>
      <CustomGameOptions model={props.model} />
      <CustomGameStart model={props.model} />
    </>
  );
}
