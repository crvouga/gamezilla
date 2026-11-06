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
  /**
   * `lg` (default): 64px buttons, for steering in real time. `md`: 48px
   * buttons, for stepping a turn at a time beside other controls. `sm`:
   * 44px buttons, a thumb's pad that fits under a phone's board with the
   * board in view (still a full touch target).
   */
  readonly size?: 'sm' | 'md' | 'lg' | undefined;
  /**
   * `cross` (default): up over left and right beside an empty centre, down
   * below. `arrows`: the keyboard's arrow keys, up over left, down and
   * right, a row shorter, so a phone's board keeps more of the screen.
   */
  readonly layout?: 'cross' | 'arrows' | undefined;
};

/** Up on top, left and right beside an empty centre, down below. */
const HEADINGS: readonly DirectionPadHeading[] = [
  'up',
  'left',
  'right',
  'down',
];

/** The arrow keys' order: up, then left, down and right in one row. */
const ARROW_HEADINGS: readonly DirectionPadHeading[] = [
  'up',
  'left',
  'down',
  'right',
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
      data-size={props.size ?? 'lg'}
      data-layout={props.layout ?? 'cross'}
      role="group"
      data-disabled={props.disabled}
    >
      <For each={props.layout === 'arrows' ? ARROW_HEADINGS : HEADINGS}>
        {(heading) => <PadButton heading={heading} pad={props} />}
      </For>
    </div>
  );
}
