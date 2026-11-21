import { decodeLightCyclesPosition } from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type {
  GameBoardProps,
  GameSimulationControls,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { DirectionPad } from '@pkgs/ui-root-client-ts/direction-pad';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import {
  TrailArena,
  type TrailHeading,
} from '@pkgs/ui-root-client-ts/trail-arena';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createMemo, createUniqueId, For, type JSX, Show } from 'solid-js';
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

/**
 * Every rider's round wins and the round, for a listener: the eye reads
 * them from the players' strips (round wins) and the turn line (the
 * round), so they are not drawn a second time over the arena.
 */
function Scores(props: { state: LightCyclesState; testId: string }) {
  return (
    <VisuallyHidden>
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
    </VisuallyHidden>
  );
}

/**
 * How to steer, in one line under the arena: by keys on a wide screen
 * (keyboard first, so no pad is drawn there), by swipe or the pad beside it
 * on a phone. It also describes the arena to a listener.
 */
function SteeringHint(props: { id: string }): JSX.Element {
  const mode = useLayoutMode();
  return (
    <P id={props.id} variant="caption" tone="secondary">
      <Show
        when={mode() === 'wide'}
        fallback={
          <Trans>
            Swipe the arena or use the pad to steer. Avoid the edge and every
            trail.
          </Trans>
        }
      >
        <Trans>
          Steer with the arrow keys or W, A, S and D. Avoid the edge and every
          trail.
        </Trans>
      </Show>
    </P>
  );
}

/** One rider's pad: a full-width steering bar alone, a small T beside another. */
function RiderPad(props: {
  state: LightCyclesState;
  board: GameBoardProps;
  side: GameSide;
  shared: boolean;
  steerable: (side: GameSide) => boolean;
}): JSX.Element {
  return (
    <DirectionPad
      // Alone, a steering bar of four 64px-tall buttons across the width,
      // right under the arena where the thumb is; two riders on one
      // device keep a small T each, side by side.
      size={props.shared ? 'sm' : 'lg'}
      layout={props.shared ? 'arrows' : 'row'}
      labels={{
        up: t`Steer ${riderName(props.side)} up`,
        right: t`Steer ${riderName(props.side)} right`,
        down: t`Steer ${riderName(props.side)} down`,
        left: t`Steer ${riderName(props.side)} left`,
      }}
      disabled={!props.steerable(props.side)}
      onDirection={(heading) =>
        steer(props.board.simulation, props.state, props.side, heading)
      }
      testId={`${props.board.testId}-${props.side}-pad`}
    />
  );
}

function Pads(props: {
  state: LightCyclesState;
  board: GameBoardProps;
  steerable: (side: GameSide) => boolean;
}): JSX.Element {
  const mode = useLayoutMode();
  const sides = () => props.board.simulation?.sides ?? [];
  const shared = () => sides().length > 1;
  return (
    <Show when={mode() !== 'wide'}>
      <Show
        when={shared()}
        fallback={
          <For each={sides()}>
            {(side) => (
              <RiderPad
                state={props.state}
                board={props.board}
                side={side}
                shared={false}
                steerable={props.steerable}
              />
            )}
          </For>
        }
      >
        <StackHorizontal gap="lg" justify="center" wrap>
          <For each={sides()}>
            {(side) => (
              <StackVertical gap="xs" align="center">
                {/* Pads for two riders on one device say whose each is. */}
                <Text variant="label">{riderName(side)}</Text>
                <RiderPad
                  state={props.state}
                  board={props.board}
                  side={side}
                  shared
                  steerable={props.steerable}
                />
              </StackVertical>
            )}
          </For>
        </StackHorizontal>
      </Show>
    </Show>
  );
}

/**
 * Over a wide arena, one bar: the person's steering status (`You ride
 * Comet.`) at its start and how to steer at its end, so neither floats as a
 * loose caption around the arena. A phone keeps the status above the arena
 * and the hint under its pad.
 */
function ArenaHeader(props: {
  wide: boolean;
  hint: JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Show when={props.wide} fallback={props.children}>
      <Surface
        tone="surface"
        border
        radius="card"
        paddingX="md"
        paddingY="sm"
        testId="light-cycles-arena-header"
      >
        <StackHorizontal align="center" justify="between" gap="md" wrap>
          {props.children}
          {props.hint}
        </StackHorizontal>
      </Surface>
    </Show>
  );
}

function Arena(props: {
  state: LightCyclesState;
  board: GameBoardProps;
}): JSX.Element {
  const instructionsId = createUniqueId();
  const mode = useLayoutMode();
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
      <ArenaHeader
        wide={mode() === 'wide'}
        hint={<SteeringHint id={instructionsId} />}
      >
        <P
          role="status"
          testId={`${props.board.testId}-status`}
          dataSet={{ steering: ownSteering() }}
        >
          {steeringText(ownSteering(), primary())}
        </P>
      </ArenaHeader>
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
        // A phone's cells are small: its heads are drawn larger.
        heads={mode() === 'wide' ? 'regular' : 'large'}
        instructionsId={instructionsId}
        testId={`${props.board.testId}-arena`}
      />
      {/* A phone's thumb pad sits right under the arena, where the thumb
          is, then how to steer. */}
      <Pads state={props.state} board={props.board} steerable={steerable} />
      <Show when={mode() !== 'wide'}>
        <SteeringHint id={instructionsId} />
      </Show>
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

/**
 * The Light Cycles arena as a person sees it: the round's scores, their own
 * steering status, the arena with every trail and crash, and a direction
 * pad per rider this device steers. Everything comes from the position and
 * the simulation controls; `LightCyclesBoard` adds the sounds.
 */
export function LightCyclesBoardView(props: GameBoardProps): JSX.Element {
  const state = createMemo(() => decodeLightCycles(props.position));
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
