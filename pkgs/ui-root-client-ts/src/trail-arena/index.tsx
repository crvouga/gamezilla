import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, createUniqueId, For, Show } from 'solid-js';
import {
  type ArenaCamera,
  FIT,
  FOLLOW_ZOOM,
  followAxis,
  inspectionCamera,
  trailShapes,
} from '../trail-arena-geometry';
import {
  ArenaInspection,
  ArenaSurface,
  controlledSlots,
  RiderCameraPicker,
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
function groundRoom(board: TrailArenaProps): number {
  const scale = board.heads === 'large' ? LARGE_HEAD_SCALE : 1;
  return Math.round((1.6 * scale - 0.4) * 100) / 100;
}

function wallRoom(board: TrailArenaProps) {
  return Math.round((groundRoom(board) + WALL_ROOM) * 100) / 100;
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
  let drawing!: SVGSVGElement;
  const [camera, setCamera] = createSignal(FIT);
  const controller = inspectionCamera(setCamera);
  const follow = riderCamera(props);
  function choose(target: TrailRiderIndex | 'arena' | 'free') {
    follow.select(target === 'free' ? 'arena' : target);
    controller.fit();
    if (target === 'free') controller.scale(2);
    if (controlledSlots(props) > 0)
      drawing.parentElement?.focus({ preventScroll: true });
  }
  const input = trailArenaInput(props);
  const interactive = () => props.enabled && controlledSlots(props) > 0;
  return (
    <ArenaSurface
      enabled={props.enabled}
      riders={props.riders}
      onDirection={props.onDirection}
      class={styles['arena']}
      style={arenaShape(props.width, props.height, wallRoom(props))}
      data-interactive={String(interactive())}
      data-dimmed={String(props.dimmed === true)}
      data-zoom={follow.rider() ? FOLLOW_ZOOM : camera().zoom}
      data-round={props.round}
      data-clear-corner={
        follow.rider() &&
        (follow.rider()?.x ?? 0) >= props.width / 2 &&
        (follow.rider()?.y ?? 0) < 5
          ? 'right'
          : undefined
      }
      data-follow={follow.rider()?.index ?? 'arena'}
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
        ref={drawing}
        class={styles['drawing']}
        data-testid={`${props.testId}-drawing`}
        viewBox={arenaBox(props, follow.rider() ? FIT : camera())}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <TrackedField board={props} follow={follow} arenaId={arenaId} />
      </svg>
      <Show when={props.inspectable && !interactive() && !follow.rider()}>
        <ArenaInspection
          drawing={() => drawing}
          camera={camera()}
          controller={controller}
        />
      </Show>
      <Show when={props.round !== undefined}>
        <RiderCameraPicker
          riders={props.riders}
          inspectable={props.inspectable === true}
          selected={String(
            follow.rider()?.index ?? (camera().zoom > 1 ? 'free' : 'arena')
          )}
          choose={choose}
        />
      </Show>
      <TouchRegions regions={props.touchRegions} testId={props.testId} />
      <ArenaOverlay overlay={props.overlay} testId={props.testId} />
    </ArenaSurface>
  );
}

function arenaBox(board: TrailArenaProps, camera: ArenaCamera) {
  const margin = wallRoom(board);
  const width = board.width + 2 * margin;
  const height = board.height + 2 * margin;
  return `${camera.x * width - margin} ${camera.y * height - margin} ${width / camera.zoom} ${height / camera.zoom}`;
}

function riderCamera(props: TrailArenaProps) {
  const [choice, setChoice] = createSignal<{
    scope: string;
    target: TrailRiderIndex | 'arena';
  }>();
  const local = createMemo(() =>
    props.riders
      .filter((r) => r.controlSlot !== null)
      .map((r) => r.index)
      .join(',')
  );
  const rider = createMemo(() => {
    if (props.round === undefined) return;
    const selected = choice();
    if (selected && selected.scope === local())
      return props.riders.find((r) => r.index === selected.target);
    return props.riders.find((r) => String(r.index) === local());
  });
  return {
    rider,
    select: (target: TrailRiderIndex | 'arena') =>
      setChoice({ scope: local(), target }),
    session: () => (rider() ? `${rider()?.index}/${props.round}` : undefined),
  };
}

function TrackedField(props: {
  board: TrailArenaProps;
  follow: ReturnType<typeof riderCamera>;
  arenaId: string;
}) {
  return (
    <Show
      when={props.follow.session()}
      keyed
      fallback={<ArenaField board={props.board} arenaId={props.arenaId} />}
    >
      {(_session) => (
        <FollowingField
          board={props.board}
          rider={props.follow.rider}
          arenaId={props.arenaId}
        />
      )}
    </Show>
  );
}

function FollowingField(props: {
  board: TrailArenaProps;
  rider: () => TrailArenaProps['riders'][number] | undefined;
  arenaId: string;
}) {
  const margin = () => wallRoom(props.board);
  const origin = createMemo<{ x: number; y: number }>((previous) => {
    const rider = props.rider();
    const axis = (cell: number, size: number, prior?: number) =>
      followAxis(cell + 0.5 + margin(), size + 2 * margin(), prior);
    return {
      x: axis(rider?.x ?? 0, props.board.width, previous?.x),
      y: axis(rider?.y ?? 0, props.board.height, previous?.y),
    };
  });
  const offset = (v: number) => (FOLLOW_ZOOM - 1) * margin() - v * FOLLOW_ZOOM;
  return (
    <g
      data-follow-field=""
      class={styles['followingField']}
      style={{
        transform: `matrix(${FOLLOW_ZOOM},0,0,${FOLLOW_ZOOM},${offset(origin().x)},${offset(origin().y)})`,
      }}
    >
      <ArenaField board={props.board} arenaId={props.arenaId} />
    </g>
  );
}

function ArenaField(props: { board: TrailArenaProps; arenaId: string }) {
  const ground = () => groundRoom(props.board);
  const shapes = createMemo(() =>
    trailShapes(props.board.cells, props.board.width, props.board.height)
  );
  return (
    <>
      <ArenaPatterns arenaId={props.arenaId} indices={TRAIL_RIDER_INDICES} />
      {/* The arena's own ground, inside its walls: the walls are its one
            frame, with no second card around them. */}
      <rect
        class={styles['ground']}
        x={-ground()}
        y={-ground()}
        width={props.board.width + 2 * ground()}
        height={props.board.height + 2 * ground()}
        rx="0.5"
      />
      <rect
        class={styles['floor']}
        width={props.board.width}
        height={props.board.height}
        rx="0.5"
        fill={`url(#${props.arenaId}-grid)`}
      />
      <Show when={props.board.touchRegions}>
        <path
          class={styles['touchDivider']}
          d={`M ${props.board.width / 2} ${-ground()} V ${props.board.height + ground()}`}
        />
      </Show>
      <For each={TRAIL_RIDER_INDICES}>
        {(index) => (
          <TrailPath
            arenaId={props.arenaId}
            index={index}
            shape={() => shapes()[index]}
            testId={props.board.testId}
          />
        )}
      </For>
      <rect
        class={styles['wall']}
        stroke={`url(#${props.arenaId}-rim)`}
        x={-ground()}
        y={-ground()}
        width={props.board.width + 2 * ground()}
        height={props.board.height + 2 * ground()}
        rx="0.5"
      />
      <Markers
        riders={props.board.riders}
        crashes={props.board.crashes}
        counts={(index) => shapes()[index]?.count ?? 0}
        scale={props.board.heads === 'large' ? LARGE_HEAD_SCALE : 1}
        testId={props.board.testId}
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
