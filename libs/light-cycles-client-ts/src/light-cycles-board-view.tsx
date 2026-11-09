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
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import {
  TrailArena,
  type TrailHeading,
} from '@pkgs/ui-root-client-ts/trail-arena';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import {
  createMemo,
  createUniqueId,
  For,
  Index,
  type JSX,
  Show,
} from 'solid-js';
import {
  arenaDescription,
  arenaOverlay,
  awayOverlay,
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
      {/* By seat index: a new decoded state every tick reuses these nodes. */}
      <Index each={props.state.riders}>
        {(rider, index) => (
          <Text
            variant="label"
            numeral
            testId={`${props.testId}-score-${rider().seat}`}
            dataSet={{
              score: String(props.state.scores[index] ?? 0),
              alive: String(rider().alive),
            }}
          >{t`${riderName(rider().seat)} ${props.state.scores[index] ?? 0}`}</Text>
        )}
      </Index>
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
function SteeringHint(props: {
  id: string;
  sides: readonly GameSide[];
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <P id={props.id} variant="caption" tone="secondary">
      <Show
        when={mode() === 'wide'}
        fallback={
          <Show
            when={props.sides.length > 1}
            fallback={
              <Trans>
                Swipe the arena or use the pad to steer. Avoid the edge and
                every trail. Keyboard: click or Tab to the arena, then use arrow
                keys or W, A, S and D.
              </Trans>
            }
          >
            <Trans>
              Swipe your half or use your pad. Avoid edges and trails. Keyboard:
              click or Tab to the arena. {riderName(props.sides[0]!)} uses arrow
              keys; {riderName(props.sides[1]!)} uses W, A, S and D.
            </Trans>
          </Show>
        }
      >
        <Show
          when={props.sides.length > 1}
          fallback={
            <Trans>
              Click the arena or Tab to it, then steer with arrow keys or W, A,
              S and D. You can also drag to steer. Avoid edges and trails.
            </Trans>
          }
        >
          <Trans>
            Focus the arena. {riderName(props.sides[0]!)} uses arrow keys;{' '}
            {riderName(props.sides[1]!)} uses W, A, S and D. Avoid the edge and
            every trail. You can also drag your half to steer.
          </Trans>
        </Show>
      </Show>
    </P>
  );
}

function Pads(props: {
  state: LightCyclesState;
  board: GameBoardProps;
  steerable: (side: GameSide) => boolean;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={mode() !== 'wide'}>
      <StackHorizontal gap="lg" justify="center" wrap>
        <For
          each={(props.board.simulation?.sides ?? [])
            .filter(props.steerable)
            .reverse()}
        >
          {(side) => (
            <StackVertical gap="xs" align="center">
              {/* One pad is the person's own rider, named above the arena;
                  pads for two riders on one device say whose each is. */}
              <Show when={(props.board.simulation?.sides.length ?? 0) > 1}>
                <Text variant="label">{riderName(side)}</Text>
              </Show>
              <DirectionPad
                size="sm"
                // The arrow keys' T, a row shorter than a cross, so the
                // arena keeps more of a phone's screen.
                layout="arrows"
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
    </Show>
  );
}

function Arena(props: {
  state: LightCyclesState;
  board: GameBoardProps;
}): JSX.Element {
  const instructionsId = createUniqueId();
  const statusId = createUniqueId();
  const descriptionId = createUniqueId();
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
  const canSteerHere = () => controlled().some(steerable);
  // The game is away: the arena dims and says so where the player looks.
  const away = () =>
    props.board.simulation?.stale === true ||
    props.board.simulation?.paused === true;
  return (
    <StackVertical gap="md" testId={props.board.testId}>
      <Scores state={props.state} testId={props.board.testId} />
      <VisuallyHidden>
        <P id={descriptionId} testId={`${props.board.testId}-description`}>
          {arenaDescription(props.state, controlled())}
        </P>
      </VisuallyHidden>
      <P
        id={statusId}
        role="status"
        testId={`${props.board.testId}-status`}
        dataSet={{ steering: ownSteering() }}
      >
        <Show
          when={
            props.state.phase === 'round-over' ||
            props.state.phase === 'completed'
          }
          fallback={
            controlled().length > 1
              ? controlled()
                  .map((side) => steeringText(steering(side), side))
                  .join(' ')
              : steeringText(ownSteering(), primary())
          }
        >
          <Text variant="bodyBold" testId={`${props.board.testId}-result`}>
            {arenaOverlay(props.state)?.title}
          </Text>{' '}
          <Text variant="caption">{arenaOverlay(props.state)?.detail}</Text>
        </Show>
      </P>
      <RideHere board={props.board} shown={ownSteering() === 'elsewhere'} />
      <TrailArena
        touchRegions={
          controlled().length === 2 && controlled().some(steerable)
            ? [
                t`Left: ${riderName(controlled()[1]!)}`,
                t`Right: ${riderName(controlled()[0]!)}`,
              ]
            : undefined
        }
        width={props.state.width}
        height={props.state.height}
        cells={props.state.trails}
        riders={trailRiders(props.state, controlled())}
        crashes={trailCrashes(props.state)}
        overlay={
          away()
            ? awayOverlay()
            : props.state.phase === 'countdown'
              ? arenaOverlay(props.state)
              : undefined
        }
        dimmed={away()}
        enabled={canSteerHere()}
        onDirection={(heading, slot) => {
          const side = controlled()[slot];
          if (side !== undefined && steerable(side))
            steer(props.board.simulation, props.state, side, heading);
        }}
        label={t`Light Cycles arena`}
        // A phone's cells are small: its heads are drawn larger.
        heads={mode() === 'wide' ? 'regular' : 'large'}
        instructionsId={`${canSteerHere() ? instructionsId : statusId} ${descriptionId}`}
        testId={`${props.board.testId}-arena`}
      />
      {/* A phone's thumb pad sits right under the arena, where the thumb
          is, then how to steer. */}
      <Pads state={props.state} board={props.board} steerable={steerable} />
      <Show when={canSteerHere()}>
        <SteeringHint id={instructionsId} sides={controlled()} />
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
        // The way back leads, on a warning surface, ahead of the quiet
        // game actions below the board.
        <Notice
          tone="warning"
          dataSet={{ testid: `${props.testId}-unreadable` }}
        >
          <StackVertical gap="sm">
            <P role="alert">
              <Trans>
                This game cannot be shown by this app. Check your app version,
                install an available update, then reopen this game.
              </Trans>
            </P>
            <TextLink
              href="/more/about"
              variant="standalone"
              testId={`${props.testId}-app-info`}
            >
              <Trans>Check app version</Trans>
            </TextLink>
          </StackVertical>
        </Notice>
      }
    >
      {(game) => <Arena state={game()} board={props} />}
    </Show>
  );
}
