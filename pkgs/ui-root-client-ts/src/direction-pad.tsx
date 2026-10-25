import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import styles from './direction-pad.module.css';

export type DirectionPadHeading = 'up' | 'right' | 'down' | 'left';

export type DirectionPadProps = {
  /** Accessible name of each button. */
  readonly labels: {
    readonly up: string;
    readonly right: string;
    readonly down: string;
    readonly left: string;
  };
  readonly disabled: boolean;
  readonly onDirection: (heading: DirectionPadHeading) => void;
  /** The group's `data-testid`; each button is `${testId}-<heading>`. */
  readonly testId: string;
};

/** Up on top, left and right beside an empty centre, down below. */
const HEADINGS: readonly DirectionPadHeading[] = [
  'up',
  'left',
  'right',
  'down',
];

const ROTATION: Readonly<Record<DirectionPadHeading, number>> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

function PadButton(props: {
  heading: DirectionPadHeading;
  pad: DirectionPadProps;
}): JSX.Element {
  // A press that already steered on pointer-down must not steer again on its click.
  let pressed = false;
  const fire = () => {
    if (!props.pad.disabled) props.pad.onDirection(props.heading);
  };
  return (
    <button
      type="button"
      class={styles['button']}
      data-heading={props.heading}
      data-testid={`${props.pad.testId}-${props.heading}`}
      aria-label={props.pad.labels[props.heading]}
      disabled={props.pad.disabled}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pressed = true;
        fire();
      }}
      onPointerCancel={() => {
        pressed = false;
      }}
      onClick={(event) => {
        const fromPointer = pressed && event.detail !== 0;
        pressed = false;
        if (!fromPointer) fire();
      }}
    >
      <svg class={styles['glyph']} viewBox="-12 -12 24 24" aria-hidden="true">
        <path
          d="M-7 3L0 -4L7 3"
          transform={`rotate(${ROTATION[props.heading]})`}
        />
      </svg>
    </button>
  );
}

/**
 * Four large steering buttons for touch screens. A press steers on
 * pointer-down, without waiting for the click; keyboard and assistive
 * technology activation steer on click.
 */
export function DirectionPad(props: DirectionPadProps): JSX.Element {
  return (
    <div
      {...dataAttrs({ component: 'DirectionPad', testid: props.testId })}
      class={styles['pad']}
      role="group"
      data-disabled={props.disabled}
    >
      <For each={HEADINGS}>
        {(heading) => <PadButton heading={heading} pad={props} />}
      </For>
    </div>
  );
}
