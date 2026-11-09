import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createMemo,
  createUniqueId,
  For,
  Index,
  type JSX,
  Show,
} from 'solid-js';
import { trailShapes } from '../trail-arena-geometry';
import { controlledSlots, trailArenaInput } from '../trail-arena-input';
import {
  ArenaOverlay,
  ArenaPatterns,
  CrashMarker,
  RiderHead,
  TrailPath,
} from '../trail-arena-parts/index';
import {
  TRAIL_RIDER_INDICES,
  type TrailArenaProps,
  type TrailRiderIndex,
} from '../trail-arena-types';
import styles from './trail-arena.module.css';

export type {
  TrailArenaProps,
  TrailCrash,
  TrailHeading,
  TrailOverlay,
  TrailRider,
  TrailRiderIndex,
  TrailSlot,
} from '../trail-arena-types';

/** Room around the walls, in cells, for heads, noses and rings at the edge. */
const MARGIN = 1.5;

/**
 * How much larger `heads="large"` draws each rider's head: a phone's cells
 * are about 8px, so a head two cells across is a 16px disc with a small
 * letter; at 1.4 it is about 23px across, its letter read at a glance.
 */
export const LARGE_HEAD_SCALE = 1.4;

/**
 * A grid arena of light trails. Coordinates are cells: the viewBox is fixed
 * by the grid size, so resizing scales the drawing and never moves a cell.
 * Each rider index has its own colour token and its own trail pattern;
 * every trail is one merged path, so the cost follows the riders, not the cells.
 */
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- A keyboard-steered arena uses the ARIA application role; the direction pad provides equivalent buttons outside application mode. */
export function TrailArena(props: TrailArenaProps): JSX.Element {
  const arenaId = `trail-arena-${createUniqueId()}`;
  const input = trailArenaInput(props);
  const shapes = createMemo(() =>
    trailShapes(props.cells, props.width, props.height)
  );
  const interactive = () => props.enabled && controlledSlots(props) > 0;
  const headScale = () => (props.heads === 'large' ? LARGE_HEAD_SCALE : 1);
  return (
    <div
      {...dataAttrs({ component: 'TrailArena', testid: props.testId })}
      class={styles['arena']}
      data-interactive={interactive()}
      data-dimmed={props.dimmed === true}
      data-width={props.width}
      data-height={props.height}
      data-rider-count={props.riders.length}
      role="application"
      aria-label={props.label}
      aria-describedby={props.instructionsId}
      tabIndex={interactive() ? 0 : -1}
      onKeyDown={input.keyDown}
      onPointerDown={input.pointerDown}
      onPointerMove={input.pointerMove}
      onPointerUp={input.pointerUp}
      onPointerCancel={input.pointerUp}
      onLostPointerCapture={input.pointerUp}
    >
      <svg
        class={styles['drawing']}
        // The room around the walls hangs outside the arena's box, so the
        // walls sit flush with the column and only a head at the edge
        // reaches past them.
        style={{
          width: `${((props.width + 2 * MARGIN) / props.width) * 100}%`,
          margin: `-${(MARGIN / props.width) * 100}%`,
        }}
        data-testid={`${props.testId}-drawing`}
        viewBox={`${-MARGIN} ${-MARGIN} ${props.width + 2 * MARGIN} ${props.height + 2 * MARGIN}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <ArenaPatterns arenaId={arenaId} indices={TRAIL_RIDER_INDICES} />
        {/* The arena's own ground, inside its walls: the walls are its one
            frame, with no second card around them. */}
        <rect
          class={styles['ground']}
          width={props.width}
          height={props.height}
          rx="0.5"
        />
        <rect
          class={styles['floor']}
          width={props.width}
          height={props.height}
          fill={`url(#${arenaId}-grid)`}
        />
        <Show when={props.touchRegions}>
          <path
            class={styles['touchDivider']}
            d={`M ${props.width / 2} 0 V ${props.height}`}
          />
        </Show>
        <For each={TRAIL_RIDER_INDICES}>
          {(index) => (
            <TrailPath
              arenaId={arenaId}
              index={index}
              shape={() => shapes()[index]}
              testId={props.testId}
            />
          )}
        </For>
        <rect
          class={styles['wall']}
          width={props.width}
          height={props.height}
          rx="0.5"
        />
        <Markers
          riders={props.riders}
          crashes={props.crashes}
          counts={(index) => shapes()[index]?.count ?? 0}
          scale={headScale()}
          testId={props.testId}
        />
      </svg>
      <TouchRegions regions={props.touchRegions} testId={props.testId} />
      <ArenaOverlay overlay={props.overlay} testId={props.testId} />
    </div>
  );
}

/** Heads, then crash badges above them, so a crash is never hidden by a head. */
function Markers(props: {
  riders: TrailArenaProps['riders'];
  crashes: TrailArenaProps['crashes'];
  counts: (index: TrailRiderIndex) => number;
  scale: number;
  testId: string;
}): JSX.Element {
  return (
    <>
      <Index each={props.riders}>
        {(rider) => (
          <RiderHead
            rider={rider()}
            trailCount={props.counts(rider().index)}
            scale={props.scale}
            testId={props.testId}
          />
        )}
      </Index>
      <Index each={props.crashes}>
        {(crash) => (
          <CrashMarker
            crash={crash()}
            scale={props.scale}
            testId={props.testId}
          />
        )}
      </Index>
    </>
  );
}

/** Ownership labels sit beyond the walls so they cannot hide a rider or trail. */
function TouchRegions(props: {
  regions: TrailArenaProps['touchRegions'];
  testId: string;
}): JSX.Element {
  return (
    <Show when={props.regions}>
      {(regions) => (
        <div
          class={styles['touchRegions']}
          data-testid={`${props.testId}-touch-regions`}
        >
          <For each={regions()}>
            {(label, index) => (
              <span data-testid={`${props.testId}-touch-${index()}`}>
                {label}
              </span>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}
