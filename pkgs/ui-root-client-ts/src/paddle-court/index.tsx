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
   * Who plays each half, written low in it (`You` in a half this device
   * controls, the other player's name in theirs), so both paddles are
   * named in words, not by colour alone.
   */
  readonly sideLabels?:
    | Partial<Record<CourtSide, string | undefined>>
    | undefined;
  /**
   * Each controlled half's own native control (an upright `RangeControl`
   * with `overlay`, or nothing), laid over that half of the court: a finger drags on
   * the court itself, while keys and assistive technology reach the
   * slider, whose focus rings the half it moves.
   */
  readonly halfControl?: ((side: CourtSide) => JSX.Element) | undefined;
};

const SIDES: readonly CourtSide[] = ['first', 'second'];

/** Who plays each half, low in it: `You` in the person's own. */
function SideMarks(props: PaddleCourtProps): JSX.Element {
  return (
    <For each={SIDES}>
      {(side) => (
        <Show when={props.sideLabels?.[side]}>
          {(label) => (
            <text
              class={styles['own']}
              data-side={side}
              data-own={String(props.controlled.includes(side))}
              x={side === 'first' ? props.width / 4 : (props.width * 3) / 4}
              y={props.height * 0.94}
              font-size={String(props.height * 0.07)}
            >
              {label()}
            </text>
          )}
        </Show>
      )}
    </For>
  );
}

/**
 * The ball is drawn round and this much larger than it plays, centred where
 * it plays, so it reads at a glance on a phone's court (about 11px across
 * there instead of 6px); the game's own size still decides every bounce.
 */
export const BALL_DRAWN_SCALE = 1.8;

/**
 * Each paddle is drawn this much wider than it plays, centred where it
 * plays, so it reads as a paddle on a phone's court (about 8px wide there
 * instead of 5px); its playing width still decides every hit.
 */
export const PADDLE_DRAWN_SCALE = 1.5;

/** A controlled half's own native control, over that half of the court. */
function HalfControls(props: PaddleCourtProps): JSX.Element {
  return (
    <For each={SIDES}>
      {(side) => (
        <Show when={props.controlled.includes(side) && props.halfControl}>
          {(control) => (
            // Beside the court, not inside it: keys on the slider move it
            // alone, never the court's own keys as well.
            <div class={styles['half']} data-side={side}>
              {control()(side)}
            </div>
          )}
        </Show>
      )}
    </For>
  );
}

/**
 * Geometric play surface: the centre line and circle, each side's points
 * large and faint in its half (`score`), who plays each half
 * (`sideLabels`), the paddles and the ball, and over each half this device
 * controls its own slider (`halfControl`).
 * Resizing changes its viewBox projection, never the court coordinates.
 */
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- A keyboard-operated court uses the ARIA application role; the adjacent native sliders provide equivalent controls outside application mode. */
export function PaddleCourt(props: PaddleCourtProps): JSX.Element {
  const input = paddleCourtInput(props);
  return (
    <div class={styles['stage']}>
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
                  font-size={String(props.height * 0.18)}
                >
                  {score().first}
                </text>
                <text
                  class={styles['score']}
                  data-testid={`${props.testId}-court-score-second`}
                  x={(props.width * 3) / 4}
                  y={props.height * 0.08}
                  font-size={String(props.height * 0.18)}
                >
                  {score().second}
                </text>
              </>
            )}
          </Show>
          <SideMarks {...props} />
          <For each={props.paddles}>
            {(paddle) => (
              <rect
                class={styles['paddle']}
                data-side={paddle.side}
                data-color={paddle.color}
                data-testid={`${props.testId}-${paddle.side}-paddle`}
                data-controlled={props.controlled.includes(paddle.side)}
                x={paddle.x - (paddle.width * PADDLE_DRAWN_SCALE) / 2}
                y={paddle.y - paddle.height / 2}
                width={paddle.width * PADDLE_DRAWN_SCALE}
                height={paddle.height}
              />
            )}
          </For>
          <circle
            class={styles['ball']}
            data-testid={`${props.testId}-ball`}
            // The ball as the game plays it (court units), apart from how
            // large it is drawn: what a reader of the court relies on.
            data-ball-x={props.ball.x}
            data-ball-y={props.ball.y}
            data-ball-size={props.ball.size}
            cx={props.ball.x}
            cy={props.ball.y}
            r={(props.ball.size * BALL_DRAWN_SCALE) / 2}
          />
        </svg>
      </div>
      <HalfControls {...props} />
    </div>
  );
}
