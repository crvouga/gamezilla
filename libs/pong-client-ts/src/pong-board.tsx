import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type {
  GameBoardProps,
  GameSimulationControls,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type GameSide,
  requireTwoPlayerSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import {
  type CourtSide,
  PaddleCourt,
} from '@pkgs/ui-root-client-ts/paddle-court';
import { RangeControl } from '@pkgs/ui-root-client-ts/range-control';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import {
  createEffect,
  createMemo,
  createRenderEffect,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
  untrack,
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
  return (
    <For each={props.controls.sides}>
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
      <StackHorizontal justify="between" align="center">
        <H3
          size="heading"
          numeral
          testId={`${props.board.testId}-score-left`}
        >{t`Left ${props.state.score.left}`}</H3>
        <Text
          variant="caption"
          tone="secondary"
          testId={`${props.board.testId}-target`}
        >{t`First to ${props.state.targetScore}`}</Text>
        <H3
          size="heading"
          numeral
          testId={`${props.board.testId}-score-right`}
        >{t`Right ${props.state.score.right}`}</H3>
      </StackHorizontal>
      <P role="status" testId={`${props.board.testId}-status`}>
        {pongStatus(props.state, props.board.simulation)}
      </P>
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
      <P id={instructionsId} variant="caption" tone="secondary">
        <Trans>
          Focus the court to play. Use W and S for Left, or the arrow keys for
          your paddle. With two players on this device, the arrow keys control
          Right. Drag on your side of the court, or use the paddle sliders
          below.
        </Trans>
      </P>
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

export function PongBoard(props: GameBoardProps): JSX.Element {
  const state = createMemo(() => pongPositionCodec.decode(props.position));
  usePongInputRelease(() => props.simulation);
  usePongSounds(state, () => props.sound);
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

/** Teardown uses the last mounted control surface, never a disposed Dynamic's props. */
function usePongInputRelease(
  current: () => GameSimulationControls | undefined
): void {
  let controls: GameSimulationControls | undefined;
  createRenderEffect(() => {
    controls = current();
  });
  onCleanup(() =>
    untrack(() => {
      for (const side of controls?.sides ?? [])
        controls?.onInput(side, { kind: 'direction', direction: 0 });
      controls?.onRelease();
    })
  );
}

function usePongSounds(
  state: () => PongState | null,
  enabled: () => boolean
): void {
  const engine = useOptionalSoundEngine();
  let previous: PongState['feedback'] | null = null;
  const feedback = createMemo(() => state()?.feedback);
  createEffect(() => {
    const current = feedback();
    if (current === undefined) return;
    if (previous !== null && enabled()) {
      const sound =
        current.points > previous.points
          ? 'gameplay.scoreIncrease'
          : current.paddles > previous.paddles
            ? 'gameplay.move'
            : current.walls > previous.walls
              ? 'gameplay.place'
              : null;
      if (sound !== null) engine?.().play(sound);
    }
    previous = current;
  });
}
