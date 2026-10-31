import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
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
  }[];
  readonly ball: {
    readonly x: number;
    readonly y: number;
    readonly size: number;
  };
  readonly label: string;
  readonly instructionsId: string;
  readonly testId: string;
};

/** Geometric play surface. Resizing changes its viewBox projection, never the court coordinates. */
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
        <For each={props.paddles}>
          {(paddle) => (
            <rect
              class={styles['paddle']}
              data-side={paddle.side}
              data-testid={`${props.testId}-${paddle.side}-paddle`}
              data-controlled={props.controlled.includes(paddle.side)}
              x={paddle.x - paddle.width / 2}
              y={paddle.y - paddle.height / 2}
              width={paddle.width}
              height={paddle.height}
            />
          )}
        </For>
        <rect
          class={styles['ball']}
          data-testid={`${props.testId}-ball`}
          x={props.ball.x - props.ball.size / 2}
          y={props.ball.y - props.ball.size / 2}
          width={props.ball.size}
          height={props.ball.size}
        />
      </svg>
    </div>
  );
}
