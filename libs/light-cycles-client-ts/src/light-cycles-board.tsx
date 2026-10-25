import { decodeLightCyclesPosition } from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type {
  GameBoardProps,
  GameSimulationControls,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { DirectionPad } from '@pkgs/ui-root-client-ts/direction-pad';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import {
  TrailArena,
  type TrailHeading,
} from '@pkgs/ui-root-client-ts/trail-arena';
import {
  createEffect,
  createMemo,
  createUniqueId,
  For,
  type JSX,
  Show,
} from 'solid-js';
import {
  arenaOverlay,
  riderName,
  steeringOf,
  steeringText,
  trailCrashes,
  trailRiders,
} from './light-cycles-view';

export function decodeLightCycles(position: string): LightCyclesState | null {
  return decodeLightCyclesPosition(position);
}

function steer(
  controls: GameSimulationControls | undefined,
  state: LightCyclesState,
  side: GameSide,
  heading: TrailHeading
): void {
  controls?.onInput(side, { round: state.round, heading });
}

function Scores(props: { state: LightCyclesState; testId: string }) {
  return (
    <StackHorizontal gap="md" justify="between" align="center" wrap>
      <For each={props.state.riders}>
        {(rider, index) => (
          <Text
            variant="label"
            numeral
            testId={`${props.testId}-score-${rider.seat}`}
            dataSet={{
              score: String(props.state.scores[index()] ?? 0),
              alive: String(rider.alive),
            }}
          >{t`${riderName(rider.seat)} ${props.state.scores[index()] ?? 0}`}</Text>
        )}
      </For>
      <Text
        variant="caption"
        tone="secondary"
        testId={`${props.testId}-round`}
        dataSet={{
          round: String(props.state.round),
          phase: props.state.phase,
          target: String(props.state.targetScore),
        }}
      >{t`Round ${props.state.round} · first to ${props.state.targetScore}`}</Text>
    </StackHorizontal>
  );
}

function Pads(props: {
  state: LightCyclesState;
  board: GameBoardProps;
  steerable: (side: GameSide) => boolean;
}): JSX.Element {
  return (
    <StackHorizontal gap="lg" justify="center" wrap>
      <For each={props.board.simulation?.sides ?? []}>
        {(side) => (
          <StackVertical gap="xs" align="center">
            <Text variant="label">{riderName(side)}</Text>
            <DirectionPad
              labels={{
                up: t`Steer ${riderName(side)} up`,
                right: t`Steer ${riderName(side)} right`,
                down: t`Steer ${riderName(side)} down`,
                left: t`Steer ${riderName(side)} left`,
              }}
              disabled={!props.steerable(side)}
              onDirection={(heading) =>
                steer(props.board.simulation, props.state, side, heading)
              }
              testId={`${props.board.testId}-${side}-pad`}
            />
          </StackVertical>
        )}
      </For>
    </StackHorizontal>
  );
}

function Arena(props: {
  state: LightCyclesState;
  board: GameBoardProps;
}): JSX.Element {
  const instructionsId = createUniqueId();
  const controlled = () => props.board.simulation?.sides ?? [];
  const steering = (side: GameSide | undefined) =>
    steeringOf(props.state, props.board.simulation, side);
  const steerable = (side: GameSide) =>
    steering(side) === 'riding' || steering(side) === 'countdown';
  // The person's own rider, steered here or from another of their devices.
  const primary = () =>
    controlled()[0] ?? props.board.simulation?.elsewhere?.[0];
  const ownSteering = () => steering(primary());
  return (
    <StackVertical gap="md" testId={props.board.testId}>
      <Scores state={props.state} testId={props.board.testId} />
      <P
        role="status"
        testId={`${props.board.testId}-status`}
        dataSet={{ steering: ownSteering() }}
      >
        {steeringText(ownSteering(), primary())}
      </P>
      <RideHere board={props.board} shown={ownSteering() === 'elsewhere'} />
      <TrailArena
        width={props.state.width}
        height={props.state.height}
        cells={props.state.trails}
        riders={trailRiders(props.state, controlled())}
        crashes={trailCrashes(props.state)}
        overlay={arenaOverlay(props.state)}
        enabled={controlled().some(steerable)}
        onDirection={(heading, slot) => {
          const side = controlled()[slot];
          if (side !== undefined && steerable(side))
            steer(props.board.simulation, props.state, side, heading);
        }}
        label={t`Light Cycles arena`}
        instructionsId={instructionsId}
        testId={`${props.board.testId}-arena`}
      />
      <P id={instructionsId} variant="caption" tone="secondary">
        <Trans>
          Focus the arena and steer with the arrow keys or W, A, S and D, or use
          the direction pad. A turn straight back is ignored. Avoid the edge and
          every trail; the last rider riding wins the round.
        </Trans>
      </P>
      <Pads state={props.state} board={props.board} steerable={steerable} />
    </StackVertical>
  );
}

/** On a person's other device: steer their rider from this one instead. */
function RideHere(props: {
  board: GameBoardProps;
  shown: boolean;
}): JSX.Element {
  return (
    <Show when={props.shown ? props.board.simulation?.claim : undefined}>
      {(claim) => (
        <Button
          title={<Trans>Ride from this device</Trans>}
          variant="outline"
          onClick={() => claim()()}
          dataSet={{ testid: `${props.board.testId}-ride-here` }}
        />
      )}
    </Show>
  );
}

export function LightCyclesBoard(props: GameBoardProps): JSX.Element {
  const state = createMemo(() => decodeLightCycles(props.position));
  useLightCyclesSounds(state, () => props.sound);
  return (
    <Show
      when={state()}
      fallback={
        <P role="alert">
          <Trans>
            Light Cycles could not be opened. Return to the game choices and
            open it again.
          </Trans>
        </P>
      }
    >
      {(game) => <Arena state={game()} board={props} />}
    </Show>
  );
}

function useLightCyclesSounds(
  state: () => LightCyclesState | null,
  enabled: () => boolean
): void {
  const engine = useOptionalSoundEngine();
  let previous: { crashes: number; round: number; phase: string } | null = null;
  createEffect(() => {
    const current = state();
    if (current === null) return;
    const now = {
      crashes: current.crashes.length,
      round: current.round,
      phase: current.phase,
    };
    if (previous !== null && enabled() && previous.round === now.round) {
      if (now.phase === 'round-over' && previous.phase !== 'round-over')
        engine?.().play('gameplay.turnEnd');
      else if (now.crashes > previous.crashes)
        engine?.().play('gameplay.capture');
      else if (now.phase === 'running' && previous.phase === 'countdown')
        engine?.().play('gameplay.turnStart');
    }
    previous = now;
  });
}
