import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  otherPongSide,
  type PongSide,
  type PongState,
} from '@libs/pong-shared-ts/pong-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { GameFrameSeat } from '@pkgs/turn-game-shared-ts/game-frame';
import type {
  GameBoardProps,
  GameSimulationControls,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type GameSide,
  requireTwoPlayerSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  type CourtSide,
  PaddleCourt,
} from '@pkgs/ui-root-client-ts/paddle-court';
import { RangeControl } from '@pkgs/ui-root-client-ts/range-control';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { useHoverCapable } from '@pkgs/ui-root-client-ts/use-hover-capable';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import {
  createMemo,
  createUniqueId,
  type JSX,
  Match,
  Show,
  Switch,
  untrack,
} from 'solid-js';

const config = pongConfig();

/** What the court's status says: it is reworded only when one of these changes. */
type StatusInput = {
  readonly phase: PongState['phase'];
  readonly winner: PongState['winner'];
  readonly paused: boolean;
  readonly stale: boolean;
  readonly seconds: number;
  readonly left: number;
  readonly right: number;
  readonly servingToward: PongSide;
};
const sameStatusInput = (
  a: StatusInput | undefined,
  b: StatusInput | undefined
): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.phase === b.phase &&
    a.winner === b.winner &&
    a.paused === b.paused &&
    a.stale === b.stale &&
    a.seconds === b.seconds &&
    a.left === b.left &&
    a.right === b.right &&
    a.servingToward === b.servingToward);
const seat = (side: CourtSide) =>
  side === 'first' ? ('white' as const) : ('black' as const);
const paddleName = (side: GameSide) =>
  requireTwoPlayerSide(side) === 'white' ? t`Left paddle` : t`Right paddle`;

/** The court with each seat's player, when the host names them. */
export type PongBoardViewProps = GameBoardProps & {
  readonly seats?: readonly GameFrameSeat[] | undefined;
};

/**
 * A phone's paddle control: an upright slider laid over the paddle's own
 * half of the court, moving top to bottom as the paddle does. It draws
 * nothing but a focus ring: a finger drags on the court itself, and keys
 * and assistive technology reach the slider. A wide screen moves paddles by
 * keys and a drag on the court alone.
 */
function PaddleSlider(props: {
  side: GameSide;
  state: PongState;
  controls: GameSimulationControls | undefined;
  testId: string;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show
      when={
        mode() !== 'wide' && props.controls?.sides.includes(props.side)
          ? props.controls
          : undefined
      }
    >
      {(controls) => (
        <RangeControl
          orientation="vertical"
          paddle={props.side === 'white' ? 'player1' : 'player2'}
          overlay
          label={paddleName(props.side)}
          min={0}
          max={1000}
          step={20}
          value={
            (props.state.paddles[props.side === 'white' ? 'left' : 'right'].y /
              config.height) *
            1000
          }
          disabled={
            controls().paused ||
            controls().stale ||
            props.state.phase === 'completed'
          }
          onInput={(target) =>
            controls().onInput(props.side, {
              kind: 'target',
              target: target / 1000,
            })
          }
          dataSet={{ testid: `${props.testId}-${props.side}-control` }}
        />
      )}
    </Show>
  );
}

/**
 * Scores and the active rally for a listener. Countdown, pause and result
 * remain on court; the rally summary never obscures the moving ball.
 */
function CourtSummary(props: {
  state: PongState;
  testId: string;
  controls: GameSimulationControls | undefined;
}): JSX.Element {
  // Every frame brings a new court; these words change only with the score
  // or the phase, so they are formatted only then.
  const left = createMemo(() => props.state.score.left);
  const right = createMemo(() => props.state.score.right);
  const live = createMemo(
    () =>
      props.state.phase === 'playing' &&
      !props.controls?.paused &&
      !props.controls?.stale
  );
  return (
    <VisuallyHidden>
      <Show when={live()}>
        <Text variant="inherit" testId={`${props.testId}-status`}>
          {t`Keep the ball in play.`}
        </Text>
      </Show>
      <Text variant="inherit" testId={`${props.testId}-score-left`}>
        {t`Left ${left()}`}
      </Text>{' '}
      <Text variant="inherit" testId={`${props.testId}-score-right`}>
        {t`Right ${right()}`}
      </Text>
    </VisuallyHidden>
  );
}

/**
 * Under the court: the points that win, then how to move a paddle — by
 * keys on a wide screen, by a drag along the person's own edge of the court
 * on a phone (anywhere in their half still works). It
 * also describes the court to a listener.
 */
function CourtHint(props: {
  id: string;
  state: PongState;
  board: PongBoardViewProps;
}): JSX.Element {
  const target = createMemo(() => props.state.targetScore);
  const finished = createMemo(() => props.state.phase === 'completed');
  const mode = useLayoutMode();
  const hoverCapable = useHoverCapable();
  const shared = () => (props.board.simulation?.sides.length ?? 0) > 1;
  return (
    <P id={props.id} variant="body">
      <Text variant="inherit" testId={`${props.board.testId}-target`}>
        {t`First to ${target()}`}
      </Text>
      {' · '}
      <Show
        when={!props.board.simulation?.stale && !props.board.simulation?.paused}
        fallback={<Trans>Controls are unavailable until play resumes.</Trans>}
      >
        <Show when={!finished()} fallback={<Trans>Match finished.</Trans>}>
          <Show
            when={(props.board.simulation?.sides.length ?? 0) > 0}
            fallback={<Trans>Watching the rally.</Trans>}
          >
            <Show
              when={mode() === 'wide'}
              fallback={
                <>
                  <Show
                    when={shared()}
                    fallback={
                      <Trans>Drag up and down anywhere on the court.</Trans>
                    }
                  >
                    {t`${playerName(props.board, 'left')}: drag the left half. ${playerName(props.board, 'right')}: drag the right half.`}
                  </Show>
                  {/* A mouse or trackpad suggests a keyboard too. */}
                  <Show when={hoverCapable()}>
                    {' '}
                    <PaddleKeys board={props.board} />
                  </Show>
                </>
              }
            >
              <PaddleKeys board={props.board} />{' '}
              <Trans>You can also drag up and down.</Trans>
            </Show>
          </Show>
        </Show>
      </Show>
    </P>
  );
}

/** The one side this device plays, when it plays exactly one. */
function ownSide(board: PongBoardViewProps): PongSide | undefined {
  const sides = board.simulation?.sides ?? [];
  if (sides.length !== 1) return undefined;
  return sides[0] === 'white' ? 'left' : 'right';
}

/** Which keys move which paddle on this device. */
function PaddleKeys(props: { board: GameBoardProps }): JSX.Element {
  return (
    <Switch fallback={<Trans>The arrow keys move your paddle.</Trans>}>
      <Match when={(props.board.simulation?.sides.length ?? 0) > 1}>
        <Trans>
          W and S move the left paddle; the arrow keys move the right paddle.
        </Trans>
      </Match>
      <Match when={props.board.simulation?.sides[0] === 'white'}>
        <Trans>W and S or the arrow keys move your paddle.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * Who plays a side, as the court's status names them: `You` for the one
 * side this device controls, otherwise the seat's name, else `Left`/`Right`.
 */
function playerName(board: PongBoardViewProps, side: PongSide): string {
  const sides = board.simulation?.sides ?? [];
  const gameSide = side === 'left' ? 'white' : 'black';
  if (sides.length === 1 && sides[0] === gameSide) return t`You`;
  return (
    board.seats?.find((one) => one.side === gameSide)?.name ??
    (side === 'left' ? t`Left` : t`Right`)
  );
}

/** The most of a name one half of the court shows whole. */
const HALF_NAME_MAX = 16;

/** A name as one half of the court shows it: a long one ends in `…`. */
function fitHalf(name: string | undefined): string | undefined {
  if (name === undefined || name.length <= HALF_NAME_MAX) return name;
  return `${name.slice(0, HALF_NAME_MAX - 1)}…`;
}

/**
 * Who plays each half, low in it: `You` in each half this device controls,
 * the other player's name in theirs when the host names them.
 */
function sideLabels(
  board: PongBoardViewProps,
  controlled: readonly CourtSide[]
): Partial<Record<CourtSide, string | undefined>> {
  const label = (side: CourtSide): string | undefined =>
    controlled.length > 1
      ? (fitHalf(board.seats?.find((one) => one.side === seat(side))?.name) ??
        (side === 'first' ? t`Left player` : t`Right player`))
      : controlled.includes(side)
        ? t`You`
        : fitHalf(board.seats?.find((one) => one.side === seat(side))?.name);
  return { first: label('first'), second: label('second') };
}

/**
 * The court's status words, formatted only when what they say changes: every
 * frame brings a new court, but the words change at most once a countdown
 * second.
 */
function useCourtStatus(props: {
  state: PongState;
  board: PongBoardViewProps;
}): () => string | undefined {
  const statusInput = createMemo(
    (): StatusInput | undefined => {
      const controls = props.board.simulation;
      if (
        props.state.phase === 'playing' &&
        !controls?.paused &&
        !controls?.stale
      )
        return undefined;
      return {
        phase: props.state.phase,
        winner: props.state.winner,
        paused: controls?.paused === true,
        stale: controls?.stale === true,
        seconds: Math.ceil(props.state.countdown / config.tickRate),
        left: props.state.score.left,
        right: props.state.score.right,
        servingToward: props.state.servingToward,
      };
    },
    undefined,
    { equals: sameStatusInput }
  );
  const status = createMemo(() =>
    statusInput()
      ? untrack(() =>
          pongStatus(
            props.state,
            props.board.simulation,
            (side) => playerName(props.board, side),
            ownSide(props.board)
          )
        )
      : undefined
  );
  return status;
}

function PongScene(props: {
  state: PongState;
  board: PongBoardViewProps;
}): JSX.Element {
  const instructionsId = createUniqueId();
  const mode = useLayoutMode();
  const controlled = (): CourtSide[] =>
    (props.board.simulation?.sides ?? []).map((side) =>
      side === 'white' ? 'first' : 'second'
    );
  const enabled = () =>
    props.board.simulation !== undefined &&
    !props.board.simulation.paused &&
    !props.board.simulation.stale &&
    props.state.phase !== 'completed';
  const status = useCourtStatus(props);
  return (
    <StackVertical gap="md">
      <CourtSummary
        state={props.state}
        testId={props.board.testId}
        controls={props.board.simulation}
      />

      {/* On a phone each controlled half holds its own slider, so the
          court (its shape fixed) takes the whole width. */}
      <PaddleCourt
        status={status()}
        statusData={
          status()
            ? pongStatusStage(props.state, props.board.simulation)
            : undefined
        }
        touchHint={mode() !== 'wide' ? t`Drag` : undefined}
        sideLabels={sideLabels(props.board, controlled())}
        halfControl={(side) => (
          <PaddleSlider
            side={seat(side)}
            state={props.state}
            controls={props.board.simulation}
            testId={props.board.testId}
          />
        )}
        width={config.width}
        height={config.height}
        testId={props.board.testId}
        label={t`Pong court`}
        instructionsId={instructionsId}
        score={{
          first: String(props.state.score.left),
          second: String(props.state.score.right),
        }}
        paddles={(['first', 'second'] as const).map((side) => ({
          side,
          x:
            side === 'first'
              ? config.paddleInset
              : config.width - config.paddleInset,
          y: props.state.paddles[side === 'first' ? 'left' : 'right'].y,
          width: config.paddleWidth,
          height: config.paddleHeight,
          // Each paddle in its seat's color (Left blue, Right orange).
          color: side === 'first' ? ('player1' as const) : ('player2' as const),
        }))}
        ball={{
          x: props.state.ball.x,
          y: props.state.ball.y,
          size: config.ballRadius * 2,
        }}
        controlled={controlled()}
        enabled={enabled()}
        onDirection={(side, direction) =>
          props.board.simulation?.onInput(seat(side), {
            kind: 'direction',
            direction,
          })
        }
        onTarget={(side, target) =>
          props.board.simulation?.onInput(seat(side), {
            kind: 'target',
            target,
          })
        }
        onRelease={() => props.board.simulation?.onRelease()}
      />
      <CourtHint id={instructionsId} state={props.state} board={props.board} />
    </StackVertical>
  );
}

/** The court's own status line: the result, the connection, the serve. */
export function pongStatus(
  state: PongState,
  controls: GameSimulationControls | undefined,
  name: (side: PongSide) => string = (side) =>
    side === 'left' ? t`Left` : t`Right`,
  /** The one side this device plays, if any: its match point is "yours". */
  own?: PongSide
): string {
  if (state.phase === 'completed')
    return t`Final score ${state.score.left}–${state.score.right}`;
  if (controls?.stale) return t`Reconnecting…`;
  if (controls?.paused) return t`Paused while a player returns`;
  if (state.phase === 'countdown') {
    const serve = t`Serve in ${Math.ceil(state.countdown / config.tickRate)}`;
    const points = state.score.left + state.score.right;
    // After a point the serve goes toward the side that lost it.
    const scorer = points > 0 ? otherPongSide(state.servingToward) : null;
    const near = (side: PongSide) =>
      state.targetScore > 1 && state.score[side] === state.targetScore - 1;
    // Whose match point it is, unless it is the scorer's (just named above)
    // or both players'.
    const holder =
      near('left') === near('right')
        ? null
        : near('left')
          ? ('left' as const)
          : ('right' as const);
    const matchPoint = !(near('left') || near('right'))
      ? undefined
      : holder === null || holder === scorer
        ? t`Match point`
        : holder === own
          ? t`Your match point`
          : t`Match point: ${name(holder)}`;
    return [
      scorer === null ? undefined : t`${name(scorer)} scored`,
      matchPoint,
      serve,
    ]
      .filter((part) => part !== undefined)
      .join('\n');
  }
  return t`Keep the ball in play`;
}

/** What the court's status says, for readers that must not parse its words. */
export function pongStatusStage(
  state: PongState,
  controls: GameSimulationControls | undefined
): { stage: string; winner?: string | undefined } {
  if (state.phase === 'completed')
    return { stage: 'finished', winner: state.winner ?? undefined };
  if (controls?.stale) return { stage: 'reconnecting' };
  if (controls?.paused) return { stage: 'paused' };
  return { stage: state.phase };
}

/**
 * The Pong court as a person sees it: both scores and the points that win,
 * the court's status line, the court with its paddles and ball, and a paddle
 * slider per side this device controls. `PongBoard` adds the sounds and
 * releases the controls when the court closes.
 */
export function PongBoardView(props: PongBoardViewProps): JSX.Element {
  const state = createMemo(() => pongPositionCodec.decode(props.position));
  return (
    <Show
      when={state()}
      fallback={
        <ErrorState
          variant="compact"
          title={t`Pong could not be opened`}
          body={t`Return to your spaces to choose a game. If you're playing, resigning ends this one.`}
          details={
            <TextLink href="/" variant="standalone">
              <Trans>Back to spaces</Trans>
            </TextLink>
          }
        />
      }
    >
      {(game) => <PongScene state={game()} board={props} />}
    </Show>
  );
}
