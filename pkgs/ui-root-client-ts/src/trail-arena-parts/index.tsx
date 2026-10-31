import { createMemo, For, type JSX, Match, Show, Switch } from 'solid-js';
import styles from '../trail-arena/trail-arena.module.css';
import { headingRotation, type TrailShape } from '../trail-arena-geometry';
import type {
  TrailCrash,
  TrailOverlay,
  TrailRider,
  TrailRiderIndex,
} from '../trail-arena-types';

/** Pattern id of a rider's trail fill inside one arena. */
export function trailPatternId(arenaId: string, index: TrailRiderIndex) {
  return `${arenaId}-rider-${index}`;
}

/**
 * One cell-sized tile per rider, so colour is never the only cue: solid,
 * striped, dotted and double-outlined. Tiles sit on the cell grid, so a
 * merged run still reads as cells.
 */
function RiderTile(props: { index: TrailRiderIndex }): JSX.Element {
  return (
    <Switch>
      <Match when={props.index === 0}>
        <rect class={styles['ink']} width="1" height="1" />
      </Match>
      <Match when={props.index === 1}>
        <rect class={styles['wash']} width="1" height="1" />
        <path
          class={styles['stripe']}
          d="M-0.25 0.25L0.25 -0.25M0 1L1 0M0.75 1.25L1.25 0.75"
        />
      </Match>
      <Match when={props.index === 2}>
        <rect class={styles['wash']} width="1" height="1" />
        <circle class={styles['ink']} cx="0.5" cy="0.5" r="0.3" />
      </Match>
      <Match when={props.index === 3}>
        <rect class={styles['wash']} width="1" height="1" />
        <rect
          class={styles['outline']}
          x="0.14"
          y="0.14"
          width="0.72"
          height="0.72"
        />
        <rect
          class={styles['ink']}
          x="0.38"
          y="0.38"
          width="0.24"
          height="0.24"
        />
      </Match>
    </Switch>
  );
}

export function ArenaPatterns(props: {
  arenaId: string;
  indices: readonly TrailRiderIndex[];
}): JSX.Element {
  return (
    <defs>
      <pattern
        id={`${props.arenaId}-grid`}
        width="1"
        height="1"
        patternUnits="userSpaceOnUse"
      >
        <circle class={styles['gridDot']} r="0.08" />
      </pattern>
      <For each={props.indices}>
        {(index) => (
          <pattern
            id={trailPatternId(props.arenaId, index)}
            data-rider={index}
            width="1"
            height="1"
            patternUnits="userSpaceOnUse"
          >
            <RiderTile index={index} />
          </pattern>
        )}
      </For>
    </defs>
  );
}

/** A rider's whole trail as one path; its geometry string is memoised so an unchanged trail never touches the DOM. */
export function TrailPath(props: {
  arenaId: string;
  index: TrailRiderIndex;
  shape: () => TrailShape | undefined;
  testId: string;
}): JSX.Element {
  const d = createMemo(() => props.shape()?.d ?? '');
  const count = createMemo(() => props.shape()?.count ?? 0);
  return (
    <path
      class={styles['trail']}
      data-rider={props.index}
      data-testid={`${props.testId}-trail-${props.index}`}
      data-trail-count={count()}
      fill={`url(#${trailPatternId(props.arenaId, props.index)})`}
      d={d() === '' ? undefined : d()}
    />
  );
}

/** A rider's head: its letter on a disc, a nose toward its heading, a ring when steered here. */
export function RiderHead(props: {
  rider: TrailRider;
  trailCount: number;
  testId: string;
}): JSX.Element {
  return (
    <g
      class={styles['head']}
      data-rider={props.rider.index}
      data-testid={`${props.testId}-rider-${props.rider.index}`}
      data-x={props.rider.x}
      data-y={props.rider.y}
      data-heading={props.rider.heading}
      data-next={props.rider.next ?? props.rider.heading}
      data-alive={props.rider.alive}
      data-controlled={props.rider.controlled}
      data-mark={props.rider.mark}
      data-trail-count={props.trailCount}
      transform={`translate(${props.rider.x + 0.5} ${props.rider.y + 0.5})`}
    >
      <title>{props.rider.label}</title>
      <Show when={props.rider.controlled}>
        <circle class={styles['ring']} r="1.45" />
      </Show>
      <path
        class={styles['nose']}
        d="M-0.56 -0.74L0 -1.6L0.56 -0.74Z"
        transform={`rotate(${headingRotation(props.rider.heading)})`}
      />
      <Show
        when={
          props.rider.alive &&
          props.rider.next !== undefined &&
          props.rider.next !== props.rider.heading
        }
      >
        <path
          class={styles['next']}
          d="M-0.56 -0.74L0 -1.6L0.56 -0.74Z"
          transform={`rotate(${headingRotation(props.rider.next ?? props.rider.heading)})`}
        />
      </Show>
      <circle class={styles['disc']} r="1" />
      <text class={styles['mark']} dy="0.07">
        {props.rider.mark}
      </text>
    </g>
  );
}

/** Where a rider crashed: a cross in a broken ring, drawn above every head. */
export function CrashMarker(props: {
  crash: TrailCrash;
  testId: string;
}): JSX.Element {
  return (
    <g
      class={styles['crash']}
      data-rider={props.crash.index}
      data-testid={`${props.testId}-crash-${props.crash.index}`}
      data-x={props.crash.x}
      data-y={props.crash.y}
      transform={`translate(${props.crash.x + 0.5} ${props.crash.y + 0.5})`}
    >
      <circle class={styles['crashRing']} r="1.2" />
      <path
        class={styles['crashCross']}
        d="M-0.62 -0.62L0.62 0.62M0.62 -0.62L-0.62 0.62"
      />
    </g>
  );
}

/** The centred banner, inside a live region that stays mounted so each change is announced. */
export function ArenaOverlay(props: {
  overlay: TrailOverlay | undefined;
  testId: string;
}): JSX.Element {
  return (
    <div
      class={styles['overlay']}
      role="status"
      aria-live="polite"
      data-testid={`${props.testId}-overlay`}
      data-open={props.overlay !== undefined}
    >
      <Show when={props.overlay}>
        {(overlay) => (
          <div class={styles['banner']}>
            <span class={styles['title']}>{overlay().title}</span>
            <Show when={overlay().detail}>
              {(detail) => <span class={styles['detail']}>{detail()}</span>}
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
