import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import type { AvatarSeatColor } from '../avatar/index';
import {
  type CourtControls,
  type CourtSide,
  CourtSurface,
  paddleCourtInput,
} from '../paddle-court-input';
import { useCourtInputLifecycle } from './input-lifecycle';
import styles from './paddle-court.module.css';

export type { CourtSide } from '../paddle-court-input';

export type PaddleCourtProps = CourtControls & {
  /** A non-playing state placed where the player watches, without taking input. */
  readonly status?: string | undefined;
  /**
   * What the status says, for readers that must not depend on its words:
   * written as `data-stage` (and `data-winner` when it names one).
   */
  readonly statusData?:
    | { readonly stage: string; readonly winner?: string | undefined }
    | undefined;
  /** Translated touch verb; explicit edge cues avoid unexplained lane shading. */
  readonly touchHint?: string | undefined;
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
   * Each side's points, drawn large and bright at its own end of a
   * scoreboard over the court, outside the play, so the ball never runs
   * under them. Drawn for the eye only: the host says the score to a
   * listener.
   */
  readonly score?: { readonly first: string; readonly second: string };
  /**
   * When the court shows `score`: always (absent), or only in a short
   * landscape window (`short-landscape`), where its host drops the seat rows
   * that show the points everywhere else, so the court keeps its height.
   */
  readonly scoreboard?: 'short-landscape' | undefined;
  /**
   * Who plays each half, written small beside its points (`You` in a half
   * this device controls, the other player's name in theirs), so both
   * paddles are named in words, not by colour alone.
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

/**
 * The scoreboard over the court, outside the play, so the ball never runs
 * under it: each side's points, large and bright, at its own end, with who
 * plays it (`You` in the person's own half, the other player's name in
 * theirs) small beside them. Drawn for the eye only: the host says the
 * score to a listener.
 */
function Scoreboard(props: PaddleCourtProps): JSX.Element {
  return (
    <Show when={props.score}>
      {(score) => (
        <div
          class={styles['scoreboard']}
          aria-hidden="true"
          data-testid={`${props.testId}-scoreboard`}
        >
          <For each={SIDES}>
            {(side) => (
              <span class={styles['side']} data-side={side}>
                <span
                  class={styles['score']}
                  data-testid={`${props.testId}-court-score-${side}`}
                >
                  {side === 'first' ? score().first : score().second}
                </span>
                <Show when={props.sideLabels?.[side]}>
                  {(label) => (
                    <span
                      class={styles['own']}
                      data-side={side}
                      data-own={String(props.controlled.includes(side))}
                    >
                      {label()}
                    </span>
                  )}
                </Show>
              </span>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}

/** The share of the court's width a thumb's drag lane takes at the least. */
const LANE_SHARE = 1 / 6;

/**
 * Where a person's thumb drags their paddle: a thumb-wide lane along the
 * outer edge of each half this device controls (a sixth of the court, and
 * at least as far in as the paddle), so a thumb there moves the paddle
 * without covering most of the ball's path. A drag anywhere in the half
 * still moves it; the lane shows where it is best.
 */
function DragLanes(props: PaddleCourtProps): JSX.Element {
  const lane = (side: CourtSide): number => {
    const paddle = props.paddles.find((one) => one.side === side);
    if (paddle === undefined) return 0;
    const reach = (paddle.width * PADDLE_DRAWN_SCALE) / 2 + paddle.width;
    const past =
      side === 'first' ? paddle.x + reach : props.width - paddle.x + reach;
    return Math.max(past, props.width * LANE_SHARE);
  };
  return (
    <Show when={props.enabled}>
      <For each={SIDES.filter((side) => props.controlled.includes(side))}>
        {(side) => (
          <rect
            class={styles['lane']}
            data-side={side}
            data-testid={`${props.testId}-${side}-lane`}
            x={side === 'first' ? 0 : props.width - lane(side)}
            y={0}
            width={lane(side)}
            height={props.height}
          />
        )}
      </For>
    </Show>
  );
}

/**
 * The ball is drawn round and this much larger than it plays, centred where
 * it plays, so it reads at a glance on a phone's court (about 14px across
 * there instead of 6px); the game's own size still decides every bounce.
 */
export const BALL_DRAWN_SCALE = 2.4;

/**
 * Each paddle is drawn this much wider than it plays, centred where it
 * plays, so it reads as a paddle on a phone's court (about 11px wide there
 * instead of 5px); its playing width still decides every hit.
 */
export const PADDLE_DRAWN_SCALE = 2;

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

/** Visible state and explicit gestures keep the drawing and input unchanged. */
function CourtFeedback(props: PaddleCourtProps): JSX.Element {
  return (
    <>
      <Show when={props.status}>
        <div
          class={styles['status']}
          role="status"
          data-testid={`${props.testId}-status`}
          data-stage={props.statusData?.stage}
          data-winner={props.statusData?.winner}
        >
          {props.status}
        </div>
      </Show>
      <Show when={props.enabled && props.touchHint}>
        <For each={props.controlled}>
          {(side) => (
            <span
              class={styles['gesture']}
              data-side={side}
              aria-hidden="true"
              data-testid={`${props.testId}-${side}-gesture`}
            >
              ↕ {props.touchHint}
            </span>
          )}
        </For>
      </Show>
    </>
  );
}

/** Stationary markings on the court glass. The game pieces use the outer viewBox. */
function ArcadeMarkings(): JSX.Element {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      class={styles['glass']}
    >
      <path
        class={styles['rail']}
        d="M12 60 V24 L24 12 H576 L588 24 V60 M12 340 V376 L24 388 H576 L588 376 V340"
      />
      <path class={styles['net']} d="M300 16 V160 M300 240 V384" />
      <path
        class={styles['service']}
        d="M288 164 H312 L336 188 V212 L312 236 H288 L264 212 V188 Z"
      />
      <path
        class={styles['ticks']}
        d="M12 100 H20 M12 200 H28 M12 300 H20 M588 100 H580 M588 200 H572 M588 300 H580"
      />
    </svg>
  );
}

function CourtDrawing(props: PaddleCourtProps): JSX.Element {
  return (
    <svg
      class={styles['drawing']}
      data-testid={`${props.testId}-drawing`}
      viewBox={`0 0 ${props.width} ${props.height}`}
      aria-hidden="true"
    >
      <DragLanes {...props} />
      <ArcadeMarkings />
      <For keyed={false} each={props.paddles}>
        {(paddle) => (
          <rect
            class={styles['paddle']}
            rx={paddle().width / 3}
            data-side={paddle().side}
            data-color={paddle().color}
            data-testid={`${props.testId}-${paddle().side}-paddle`}
            data-controlled={String(props.controlled.includes(paddle().side))}
            x={paddle().x - (paddle().width * PADDLE_DRAWN_SCALE) / 2}
            y={paddle().y - paddle().height / 2}
            width={paddle().width * PADDLE_DRAWN_SCALE}
            height={paddle().height}
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
  );
}

/**
 * Geometric play surface under its scoreboard (each side's points large
 * at its own end, `score`, with who plays it beside them, `sideLabels`):
 * the centre line and circle, a thumb-wide drag lane along the outer edge of each half this
 * device controls while it can move, the paddles and the ball, and over
 * each such half its own slider (`halfControl`).
 * Resizing changes its viewBox projection, never the court coordinates.
 */
export function PaddleCourt(props: PaddleCourtProps): JSX.Element {
  const input = paddleCourtInput(props);
  let court: HTMLDivElement | undefined;
  useCourtInputLifecycle(props, input.release, () => court);
  return (
    <div
      class={styles['frame']}
      // Without its own scoreboard the points are the host's seats, a row
      // above the court and a row below it: a short window fits them too.
      // With one only in a short landscape window, the host drops its seats
      // there (`data-board-scores`).
      data-scoreboard={
        props.score === undefined ? 'false' : (props.scoreboard ?? 'true')
      }
      data-board-scores={
        props.score === undefined ? undefined : props.scoreboard
      }
      // The court's own shape, so the frame can fit a short window's height.
      style={{ '--paddle-court-aspect': `${props.width} / ${props.height}` }}
    >
      <Scoreboard {...props} />
      <div class={styles['stage']}>
        <CourtSurface
          controlled={props.controlled}
          enabled={props.enabled}
          onTarget={props.onTarget}
          onDirection={props.onDirection}
          ref={(element) => {
            court = element;
          }}
          class={styles['court']}
          data-interactive={String(
            props.enabled && props.controlled.length > 0
          )}
          {...dataAttrs({ component: 'PaddleCourt', testid: props.testId })}
          role="application"
          aria-label={props.label}
          aria-describedby={props.instructionsId}
          tabindex={props.enabled && props.controlled.length > 0 ? 0 : -1}
          onKeyDown={input.keyDown}
          onKeyUp={input.keyUp}
          onBlur={() => input.release()}
          onPointerDown={input.pointerDown}
          onPointerMove={input.pointerMove}
          onPointerUp={input.pointerUp}
          onPointerCancel={input.pointerUp}
          onLostPointerCapture={input.pointerUp}
        >
          <CourtDrawing {...props} />
          <CourtFeedback {...props} />
        </CourtSurface>
        <HalfControls {...props} />
      </div>
    </div>
  );
}
