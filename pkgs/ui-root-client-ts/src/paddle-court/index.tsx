import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import type { AvatarSeatColor } from '../avatar/index';
import {
  type CourtControls,
  type CourtSide,
  paddleCourtInput,
} from '../paddle-court-input';
import styles from './paddle-court.module.css';

export type { CourtSide } from '../paddle-court-input';

export type PaddleCourtProps = CourtControls & {
  readonly width: number;
  readonly height: number;
  readonly paddles: readonly {
    readonly side: CourtSide;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    /** The seat's player color, so the paddle matches its player's swatch. */
    readonly color?: AvatarSeatColor | undefined;
  }[];
  readonly ball: {
    readonly x: number;
    readonly y: number;
    readonly size: number;
  };
  readonly label: string;
  readonly instructionsId: string;
  readonly testId: string;
  /**
   * Each side's points, drawn large and faint in its own half of the court
   * as a court's scoreboard is, so the score reads where the play is. Drawn
   * for the eye only: the host says the score to a listener.
   */
  readonly score?: { readonly first: string; readonly second: string };
  /**
   * Written low in each half this device controls (`You`), so the person's
   * own paddle is marked in words, not by colour alone.
   */
  readonly ownLabel?: string | undefined;
};

/** `You`, low in each half this device controls. */
function OwnMarks(props: PaddleCourtProps): JSX.Element {
  return (
    <Show when={props.ownLabel}>
      {(label) => (
        <For each={props.controlled}>
          {(side) => (
            <text
              class={styles['own']}
              data-side={side}
              x={side === 'first' ? props.width / 4 : (props.width * 3) / 4}
              y={props.height * 0.94}
              font-size={String(props.height * 0.07)}
            >
              {label()}
            </text>
          )}
        </For>
      )}
    </Show>
  );
}

/**
 * The ball is drawn round and this much larger than it plays, centred where
 * it plays, so it reads at a glance on a phone's court (about 9px across
 * there instead of 5px); the game's own size still decides every bounce.
 */
export const BALL_DRAWN_SCALE = 1.6;

/**
 * Geometric play surface: the centre line and circle, each side's points
 * large and faint in its half (`score`), the paddles and the ball.
 * Resizing changes its viewBox projection, never the court coordinates.
 */
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- A keyboard-operated court uses the ARIA application role; the adjacent native sliders provide equivalent controls outside application mode. */
export function PaddleCourt(props: PaddleCourtProps): JSX.Element {
  const input = paddleCourtInput(props);
  return (
    <div
      {...dataAttrs({ component: 'PaddleCourt', testid: props.testId })}
      class={styles['court']}
      data-interactive={props.enabled && props.controlled.length > 0}
      role="application"
      aria-label={props.label}
      aria-describedby={props.instructionsId}
      tabIndex={props.enabled && props.controlled.length > 0 ? 0 : -1}
      onKeyDown={input.keyDown}
      onKeyUp={input.keyUp}
      onBlur={input.release}
      onPointerDown={input.pointerDown}
      onPointerMove={input.pointerMove}
      onPointerUp={input.pointerUp}
      onPointerCancel={input.pointerUp}
      onLostPointerCapture={input.pointerUp}
    >
      <svg
        class={styles['drawing']}
        data-testid={`${props.testId}-drawing`}
        viewBox={`0 0 ${props.width} ${props.height}`}
        aria-hidden="true"
      >
        <path
          class={styles['line']}
          d={`M ${props.width / 2} 0 V ${props.height}`}
        />
        <circle
          class={styles['ring']}
          cx={props.width / 2}
          cy={props.height / 2}
          r={props.height * 0.14}
        />
        <Show when={props.score}>
          {(score) => (
            <>
              <text
                class={styles['score']}
                data-testid={`${props.testId}-court-score-first`}
                x={props.width / 4}
                y={props.height * 0.08}
                font-size={String(props.height * 0.22)}
              >
                {score().first}
              </text>
              <text
                class={styles['score']}
                data-testid={`${props.testId}-court-score-second`}
                x={(props.width * 3) / 4}
                y={props.height * 0.08}
                font-size={String(props.height * 0.22)}
              >
                {score().second}
              </text>
            </>
          )}
        </Show>
        <OwnMarks {...props} />
        <For each={props.paddles}>
          {(paddle) => (
            <rect
              class={styles['paddle']}
              data-side={paddle.side}
              data-color={paddle.color}
              data-testid={`${props.testId}-${paddle.side}-paddle`}
              data-controlled={props.controlled.includes(paddle.side)}
              x={paddle.x - paddle.width / 2}
              y={paddle.y - paddle.height / 2}
              width={paddle.width}
              height={paddle.height}
            />
          )}
        </For>
        <circle
          class={styles['ball']}
          data-testid={`${props.testId}-ball`}
          cx={props.ball.x}
          cy={props.ball.y}
          r={(props.ball.size * BALL_DRAWN_SCALE) / 2}
        />
      </svg>
    </div>
  );
}
