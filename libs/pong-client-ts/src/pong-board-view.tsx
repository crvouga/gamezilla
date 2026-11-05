import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
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
  For,
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

function PongControls(props: {
  state: PongState;
  controls: GameSimulationControls;
  testId: string;
}): JSX.Element {
  // Keyboard first on a wide screen: the keys and a drag on the court move
  // the paddles there, so the sliders are a phone's.
  const mode = useLayoutMode();
  return (
    <For each={mode() === 'wide' ? [] : props.controls.sides}>
      {(side) => (
        <StackVertical gap="xs">
          <P variant="label">{paddleName(side)}</P>
          <RangeControl
            label={paddleName(side)}
            min={0}
            max={1000}
            step={20}
            value={
              (props.state.paddles[side === 'white' ? 'left' : 'right'].y /
                config.height) *
              1000
            }
            disabled={
              props.controls.paused ||
              props.controls.stale ||
              props.state.phase === 'completed'
            }
            onInput={(target) =>
              props.controls.onInput(side, {
                kind: 'target',
                target: target / 1000,
              })
            }
            dataSet={{ testid: `${props.testId}-${side}-control` }}
          />
        </StackVertical>
      )}
    </For>
  );
}

/**
 * Both scores and the points that win, for a listener: the eye reads the
 * points from the players' strips and the target under the court.
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
 * keys on a wide screen, by drag or the slider below on a phone. It also
 * describes the court to a listener.
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
        when={mode() === 'wide'}
        fallback={
          <Trans>Drag on your side of the court or use the slider.</Trans>
        }
      >
        <Switch fallback={<Trans>The arrow keys move your paddle.</Trans>}>
          <Match when={shared()}>
            <Trans>W and S move Left; the arrow keys move Right.</Trans>
          </Match>
          <Match when={props.board.simulation?.sides[0] === 'white'}>
            <Trans>W and S or the arrow keys move your paddle.</Trans>
          </Match>
        </Switch>
      </Show>
    </P>
  );
}

function PongScene(props: {
  state: PongState;
  board: GameBoardProps;
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
      <PaddleCourt
        width={config.width}
        height={config.height}
        testId={props.board.testId}
        label={t`Pong court`}
        instructionsId={instructionsId}
        paddles={(['first', 'second'] as const).map((side) => ({
          side,
          x:
            side === 'first'
              ? config.paddleInset
              : config.width - config.paddleInset,
          y: props.state.paddles[side === 'first' ? 'left' : 'right'].y,
          width: config.paddleWidth,
          height: config.paddleHeight,
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
      <Show when={props.board.simulation}>
        {(controls) => (
          <PongControls
            state={props.state}
            controls={controls()}
            testId={props.board.testId}
          />
        )}
      </Show>
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
export function PongBoardView(props: GameBoardProps): JSX.Element {
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
