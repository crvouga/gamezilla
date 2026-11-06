import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
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
import {
  type CourtSide,
  PaddleCourt,
} from '@pkgs/ui-root-client-ts/paddle-court';
import { RangeControl } from '@pkgs/ui-root-client-ts/range-control';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import {
  createMemo,
  createUniqueId,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';

const config = pongConfig();
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
 * Both scores and the points that win, for a listener: the eye reads the
 * points in each half of the court and the target under it.
 */
function CourtScores(props: { state: PongState; testId: string }): JSX.Element {
  return (
    <VisuallyHidden>
      <Text variant="inherit" testId={`${props.testId}-score-left`}>
        {t`Left ${props.state.score.left}`}
      </Text>{' '}
      <Text variant="inherit" testId={`${props.testId}-score-right`}>
        {t`Right ${props.state.score.right}`}
      </Text>
    </VisuallyHidden>
  );
}

/**
 * The court's own line, shown only when it says more than the game's turn
 * line does (paused, reconnecting); a listener always hears it.
 */
function CourtStatus(props: {
  state: PongState;
  board: GameBoardProps;
}): JSX.Element {
  const text = () => pongStatus(props.state, props.board.simulation);
  const own = () => text() !== pongStatus(props.state, undefined);
  return (
    <Show
      when={own()}
      fallback={
        <VisuallyHidden role="status" testId={`${props.board.testId}-status`}>
          {text()}
        </VisuallyHidden>
      }
    >
      <P role="status" testId={`${props.board.testId}-status`}>
        {text()}
      </P>
    </Show>
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
  board: GameBoardProps;
}): JSX.Element {
  const mode = useLayoutMode();
  const shared = () => (props.board.simulation?.sides.length ?? 0) > 1;
  return (
    <P id={props.id} variant="caption" tone="secondary">
      <Text variant="inherit" testId={`${props.board.testId}-target`}>
        {t`First to ${props.state.targetScore}`}
      </Text>
      {' · '}
      <Show
        when={!props.board.simulation?.stale && !props.board.simulation?.paused}
        fallback={<Trans>Controls are unavailable until play resumes.</Trans>}
      >
        <Show
          when={props.state.phase !== 'completed'}
          fallback={<Trans>Match finished.</Trans>}
        >
          <Show
            when={(props.board.simulation?.sides.length ?? 0) > 0}
            fallback={<Trans>Watching the rally.</Trans>}
          >
            <Show
              when={mode() === 'wide'}
              fallback={
                <Show
                  when={shared()}
                  fallback={
                    <Trans>
                      Drag up and down along your edge of the court.
                    </Trans>
                  }
                >
                  <Trans>
                    Left player: drag the left half. Right player: drag the
                    right half.
                  </Trans>
                </Show>
              }
            >
              <Switch
                fallback={<Trans>The arrow keys move your paddle.</Trans>}
              >
                <Match when={shared()}>
                  <Trans>W and S move Left; the arrow keys move Right.</Trans>
                </Match>
                <Match when={props.board.simulation?.sides[0] === 'white'}>
                  <Trans>W and S or the arrow keys move your paddle.</Trans>
                </Match>
              </Switch>
            </Show>
          </Show>
        </Show>
      </Show>
    </P>
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
      ? side === 'first'
        ? t`Left player`
        : t`Right player`
      : controlled.includes(side)
        ? t`You`
        : fitHalf(board.seats?.find((one) => one.side === seat(side))?.name);
  return { first: label('first'), second: label('second') };
}

function PongScene(props: {
  state: PongState;
  board: PongBoardViewProps;
}): JSX.Element {
  const instructionsId = createUniqueId();
  const controlled = (): CourtSide[] =>
    (props.board.simulation?.sides ?? []).map((side) =>
      side === 'white' ? 'first' : 'second'
    );
  const enabled = () =>
    props.board.simulation !== undefined &&
    !props.board.simulation.paused &&
    !props.board.simulation.stale &&
    props.state.phase !== 'completed';
  return (
    <StackVertical gap="md">
      <CourtScores state={props.state} testId={props.board.testId} />
      <CourtStatus state={props.state} board={props.board} />
      {/* On a phone each controlled half holds its own slider, so the
          court (its shape fixed) takes the whole width. */}
      <PaddleCourt
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
  controls: GameSimulationControls | undefined
): string {
  if (state.phase === 'completed')
    return state.winner === 'left' ? t`Left wins.` : t`Right wins.`;
  if (controls?.stale)
    return t`Reconnecting. Controls resume when the game returns.`;
  if (controls?.paused) return t`Paused while a player returns.`;
  if (state.phase === 'countdown')
    return t`Serve in ${Math.ceil(state.countdown / config.tickRate)}.`;
  return t`Keep the ball in play.`;
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
        <P role="alert">
          <Trans>
            Pong could not be opened. Return to the game choices and open it
            again.
          </Trans>
        </P>
      }
    >
      {(game) => <PongScene state={game()} board={props} />}
    </Show>
  );
}
