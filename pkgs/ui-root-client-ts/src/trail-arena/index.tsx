import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, createUniqueId, For, Index, type JSX } from 'solid-js';
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
  return (
    <div
      {...dataAttrs({ component: 'TrailArena', testid: props.testId })}
      class={styles['arena']}
      data-interactive={interactive()}
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
        data-testid={`${props.testId}-drawing`}
        viewBox={`${-MARGIN} ${-MARGIN} ${props.width + 2 * MARGIN} ${props.height + 2 * MARGIN}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <ArenaPatterns arenaId={arenaId} indices={TRAIL_RIDER_INDICES} />
        <rect
          class={styles['floor']}
          width={props.width}
          height={props.height}
          fill={`url(#${arenaId}-grid)`}
        />
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
        <Index each={props.riders}>
          {(rider) => (
            <RiderHead
              rider={rider()}
              trailCount={shapes()[rider().index]?.count ?? 0}
              testId={props.testId}
            />
          )}
        </Index>
        <Index each={props.crashes}>
          {(crash) => <CrashMarker crash={crash()} testId={props.testId} />}
        </Index>
      </svg>
      <ArenaOverlay overlay={props.overlay} testId={props.testId} />
    </div>
  );
}
