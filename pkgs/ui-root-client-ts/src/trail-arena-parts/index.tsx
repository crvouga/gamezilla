import type { JSX } from '@solidjs/web';
import { createMemo, For, Match, Show, Switch } from 'solid-js';
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
      <linearGradient id={`${props.arenaId}-rim`} x2="85%" y2="100%">
        <stop stop-color="var(--ui-color-text)" />
        <stop offset="0.64" stop-color="var(--ui-color-outline)" />
      </linearGradient>
      <pattern
        id={`${props.arenaId}-cells`}
        width="1"
        height="1"
        patternUnits="userSpaceOnUse"
      >
        <circle class={styles['gridDot']} cx="0.5" cy="0.5" r="0.09" />
      </pattern>
      <pattern
        id={`${props.arenaId}-grid`}
        width="4"
        height="4"
        patternUnits="userSpaceOnUse"
      >
        <rect width="4" height="4" fill={`url(#${props.arenaId}-cells)`} />
        <path class={styles['datum']} d="M0.5 0.2v0.6M0.2 0.5h0.6" />
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

/** The chassis shows the current heading. A detached chevron shows the queued turn. */
export function RiderHead(props: {
  rider: TrailRider;
  trailCount: number;
  /** How much larger than a cell's measure the head is drawn (a phone's small cells). */
  scale?: number | undefined;
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
      data-alive={String(props.rider.alive)}
      data-controlled={String(props.rider.controlSlot !== null)}
      data-mark={props.rider.mark}
      data-trail-count={props.trailCount}
      data-scale={props.scale ?? 1}
      transform={`translate(${props.rider.x + 0.5} ${props.rider.y + 0.5}) scale(${props.scale ?? 1})`}
    >
      <title>{props.rider.label}</title>
      <Show when={props.rider.controlSlot !== null}>
        <circle class={styles['ring']} r="1.45" />
      </Show>
      <Show
        when={props.rider.alive}
        fallback={<circle class={styles['disc']} r="1" />}
      >
        <g transform={`rotate(${headingRotation(props.rider.heading)})`}>
          <path
            class={styles['chassis']}
            d="M0 -1.6L0.62 -1.02Q0.86 -0.8 0.86 -0.42V0.35L1.04 0.65V1.08H0.52L0.34 0.85H-0.34L-0.52 1.08H-1.04V0.65L-0.86 0.35V-0.42Q-0.86 -0.8 -0.62 -1.02Z"
          />
          <path class={styles['visor']} d="M-0.42 -0.85L0 -1.22L0.42 -0.85" />
        </g>
      </Show>
      <Show
        when={
          props.rider.alive &&
          props.rider.next !== undefined &&
          props.rider.next !== props.rider.heading
        }
      >
        <path
          class={styles['next']}
          data-turn-preview={props.rider.next}
          d="M-0.62 -1.12L0 -1.76L0.62 -1.12L0.44 -0.96L0 -1.4L-0.44 -0.96Z"
          transform={`rotate(${headingRotation(props.rider.next ?? props.rider.heading)})`}
        />
      </Show>
      <text class={styles['mark']} dy="0.07">
        {props.rider.mark}
      </text>
    </g>
  );
}

/**
 * Offset of a crash badge from its cell's centre, in head radii: up and to
 * the right, so the crashed rider's own letter stays readable beside it.
 */
export const CRASH_BADGE_OFFSET = 1.05;

/**
 * Where a rider crashed: a small red diamond with a cross at the head's
 * upper right, drawn above every head. It never covers the rider's letter,
 * so who crashed still reads in a dense field of trails.
 */
export function CrashMarker(props: {
  crash: TrailCrash;
  scale?: number | undefined;
  testId: string;
}): JSX.Element {
  const scale = () => props.scale ?? 1;
  const offset = () => CRASH_BADGE_OFFSET * scale();
  return (
    <g
      class={styles['crash']}
      data-rider={props.crash.index}
      data-testid={`${props.testId}-crash-${props.crash.index}`}
      data-x={props.crash.x}
      data-y={props.crash.y}
      data-offset={offset()}
      transform={`translate(${props.crash.x + 0.5 + offset()} ${props.crash.y + 0.5 - offset()}) scale(${scale()})`}
    >
      <path class={styles['crashBadge']} d="M0 -0.74L0.74 0L0 0.74L-0.74 0Z" />
      <path
        class={styles['crashCross']}
        d="M-0.24 -0.24L0.24 0.24M0.24 -0.24L-0.24 0.24"
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
      data-open={String(props.overlay !== undefined)}
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
