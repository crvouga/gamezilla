import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createMemo, createUniqueId, For, Show } from 'solid-js';
import { trailShapes } from '../trail-arena-geometry';
import {
  ArenaSurface,
  controlledSlots,
  trailArenaInput,
} from '../trail-arena-input';
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

/** Room outside the walls, in cells, for the focus ring drawn on them. */
const WALL_ROOM = 0.3;

/**
 * How much larger `heads="large"` draws each rider's head: a phone's cells
 * are about 8px, so a head two cells across is a 16px disc with a small
 * letter; at 1.4 it is about 23px across, its letter read at a glance.
 */
export const LARGE_HEAD_SCALE = 1.4;

/**
 * The ground's room around the grid, in cells: as far as a head on an edge
 * cell reaches past it (its nose, 1.6 head radii from the cell's centre),
 * so every rider, nose and all, is drawn inside the walls.
 */
function groundRoom(scale: number): number {
  return Math.round((1.6 * scale - 0.4) * 100) / 100;
}

/**
 * The arena's shape for its stylesheet: `--arena-fit` is the whole
 * drawing's width over its height (walls and the room around them), so a
 * room shorter than the arena is wide narrows it until the whole drawing
 * fits instead of running off the bottom. Nothing hangs outside its box.
 */
function arenaShape(width: number, height: number, room: number) {
  return {
    '--arena-fit': String((width + 2 * room) / (height + 2 * room)),
  } satisfies JSX.CSSProperties;
}

/**
 * A grid arena of light trails. Coordinates are cells: the viewBox is fixed
 * by the grid size, so resizing scales the drawing and never moves a cell.
 * Each rider index has its own colour token and its own trail pattern;
 * every trail is one merged path, so the cost follows the riders, not the cells.
 */
export function TrailArena(props: TrailArenaProps): JSX.Element {
  const arenaId = `trail-arena-${createUniqueId()}`;
  const input = trailArenaInput(props);
  const shapes = createMemo(() =>
    trailShapes(props.cells, props.width, props.height)
  );
  const interactive = () => props.enabled && controlledSlots(props) > 0;
  const headScale = () => (props.heads === 'large' ? LARGE_HEAD_SCALE : 1);
  const ground = () => groundRoom(headScale());
  const room = () => Math.round((ground() + WALL_ROOM) * 100) / 100;
  return (
    <ArenaSurface
      enabled={props.enabled}
      riders={props.riders}
      onDirection={props.onDirection}
      class={styles['arena']}
      style={arenaShape(props.width, props.height, room())}
      data-interactive={String(interactive())}
      data-dimmed={String(props.dimmed === true)}
      data-width={props.width}
      data-height={props.height}
      data-rider-count={props.riders.length}
      // Sized by its width, in its own shape: a stage gives it a room it
      // fits whole in, never one it is stretched to fill.
      data-board-sizing="width"
      {...dataAttrs({ component: 'TrailArena', testid: props.testId })}
      role="application"
      aria-label={props.label}
      aria-describedby={props.instructionsId}
      tabindex={interactive() ? 0 : -1}
      onKeyDown={input.keyDown}
      onPointerDown={input.pointerDown}
      onPointerMove={input.pointerMove}
      onPointerUp={input.pointerUp}
      onPointerCancel={input.pointerUp}
      onLostPointerCapture={input.pointerUp}
    >
      {/* The walls stand a head's reach out from the grid, inside the
          arena's box: a rider on an edge cell is drawn whole, inside them. */}
      <svg
        class={styles['drawing']}
        data-testid={`${props.testId}-drawing`}
        viewBox={`${-room()} ${-room()} ${props.width + 2 * room()} ${props.height + 2 * room()}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <ArenaPatterns arenaId={arenaId} indices={TRAIL_RIDER_INDICES} />
        <Ground
          arenaId={arenaId}
          width={props.width}
          height={props.height}
          room={ground()}
        />
        <Show when={props.touchRegions}>
          <path
            class={styles['touchDivider']}
            d={`M ${props.width / 2} ${-ground()} V ${props.height + ground()}`}
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
          x={-ground()}
          y={-ground()}
          width={props.width + 2 * ground()}
          height={props.height + 2 * ground()}
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
    </ArenaSurface>
  );
}

/**
 * The arena's own ground, filling its walls (a head's reach around the
 * grid) and rounded as they are, and its dotted floor on the grid the
 * riders ride: the walls are its one frame, with no second card around it.
 */
function Ground(props: {
  arenaId: string;
  width: number;
  height: number;
  /** The ground's room around the grid, in cells. */
  room: number;
}): JSX.Element {
  return (
    <>
      <rect
        class={styles['ground']}
        x={-props.room}
        y={-props.room}
        width={props.width + 2 * props.room}
        height={props.height + 2 * props.room}
        rx="0.5"
      />
      <rect
        class={styles['floor']}
        width={props.width}
        height={props.height}
        rx="0.5"
        fill={`url(#${props.arenaId}-grid)`}
      />
    </>
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
      <For keyed={false} each={props.riders}>
        {(rider) => (
          <RiderHead
            rider={rider()}
            trailCount={props.counts(rider().index)}
            scale={props.scale}
            testId={props.testId}
          />
        )}
      </For>
      <For keyed={false} each={props.crashes}>
        {(crash) => (
          <CrashMarker
            crash={crash()}
            scale={props.scale}
            testId={props.testId}
          />
        )}
      </For>
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
