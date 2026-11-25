import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';
export type PathGridTone =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';

export type PathGridEndpoint = {
  readonly cell: number;
  readonly tracing?: boolean | undefined;
  readonly label: string;
  readonly tone: PathGridTone;
  readonly connected: boolean;
};

export type PathGridLine = {
  readonly stitch?: number;
  readonly id: string;
  readonly cells: readonly number[];
  readonly tone: PathGridTone;
  readonly connected: boolean;
  /** Still being drawn: shown, but not yet saved. */
  readonly provisional?: boolean | undefined;
};

export type PathGridTraceCancellation =
  | 'boundary'
  | 'interrupted'
  | 'stationary';

export type PathGridBoardProps = {
  readonly columns: number;
  readonly rows: number;
  readonly label: string;
  readonly testId: string;
  readonly endpoints: readonly PathGridEndpoint[];
  readonly lines: readonly PathGridLine[];
  readonly cellLabel: (index: number) => string;
  /** The endpoint chosen for editing; marked independently of pair color and focus. */
  readonly selectedCell?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly navigationHint?: string;
  readonly onActivate?: ((index: number) => void) | undefined;
  readonly onNavigate?: ((index: number) => void) | undefined;
  readonly onCellKey?: ((key: string, index: number) => boolean) | undefined;
  readonly onTraceStart?: ((index: number) => void) | undefined;
  readonly onTraceMove?: ((index: number) => void) | undefined;
  readonly onTraceEnd?: (() => void) | undefined;
  readonly onTraceCancel?:
    | ((reason: PathGridTraceCancellation) => void)
    | undefined;
};

type Point = { readonly x: number; readonly y: number };
type Grid = { readonly columns: number; readonly rows: number };

/** Cells under a straight pointer segment, including crossed cells between samples. */
export function pathGridSegment(from: Point, to: Point, grid: Grid): number[] {
  let x = Math.floor(from.x);
  let y = Math.floor(from.y);
  const endX = Math.floor(to.x);
  const endY = Math.floor(to.y);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const stepX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const stepY = dy === 0 ? Infinity : Math.abs(1 / dy);
  let crossX =
    dx === 0 ? Infinity : (sx > 0 ? x + 1 - from.x : from.x - x) / Math.abs(dx);
  let crossY =
    dy === 0 ? Infinity : (sy > 0 ? y + 1 - from.y : from.y - y) / Math.abs(dy);
  const cells: number[] = [];
  // A straight segment crosses at most one row and one column boundary per step.
  for (
    let n = 0;
    n < grid.columns + grid.rows && (x !== endX || y !== endY);
    n++
  ) {
    if (crossX <= crossY) {
      x += sx;
      crossX += stepX;
    } else {
      y += sy;
      crossY += stepY;
    }
    if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) break;
    cells.push(y * grid.columns + x);
  }
  return cells;
}

function gridPoint(
  event: PointerEvent,
  box: DOMRect | undefined,
  grid: Grid
): Point | null {
  if (box === undefined || box.width <= 0 || box.height <= 0) return null;
  const x = ((event.clientX - box.left) / box.width) * grid.columns;
  const y = ((event.clientY - box.top) / box.height) * grid.rows;
  return x >= 0 && y >= 0 && x < grid.columns && y < grid.rows
    ? { x, y }
    : null;
}

// Older browsers deliver only the dispatched sample.
function coalescedSamples(
  event: Partial<Pick<PointerEvent, 'getCoalescedEvents'>>
) {
  return event.getCoalescedEvents?.() ?? [];
}

function focusStart(
  root: HTMLElement | undefined,
  start: Point,
  columns: number
) {
  const index = Math.floor(start.y) * columns + Math.floor(start.x);
  root
    ?.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`)
    ?.focus({ preventScroll: true });
  return index;
}

function sampleWithin(event: PointerEvent, box: DOMRect) {
  return (
    event.clientX >= box.left &&
    event.clientX < box.right &&
    event.clientY >= box.top &&
    event.clientY < box.bottom
  );
}

function visitSamples(
  event: PointerEvent,
  clip: DOMRect,
  visit: (sample: PointerEvent, inside: boolean) => boolean
) {
  for (const sample of coalescedSamples(event))
    if (!visit(sample, sampleWithin(sample, clip))) return;
  visit(event, sampleWithin(event, clip));
}

function canStart(event: PointerEvent, props: PathGridBoardProps) {
  return props.disabled !== true && event.button === 0 && event.isPrimary;
}

export function createPathGridPointer(
  props: PathGridBoardProps,
  element: () => HTMLDivElement | undefined,
  bounds: (clip: DOMRect) => DOMRect
) {
  let active: number | null = null;
  const capturedPointer = (): number | null => active;
  let previous: Point | null = null;
  let traced = false;
  const cancel = (
    reason: PathGridTraceCancellation = 'interrupted',
    keepCapture = false
  ): void => {
    if (active === null && !keepCapture) return;
    const pointer = active;
    active = null;
    if (!keepCapture && pointer !== null)
      element()?.releasePointerCapture(pointer);
    props.onTraceCancel?.(reason);
  };
  const traceSample = (
    sample: PointerEvent,
    box: DOMRect | undefined
  ): void => {
    const next = gridPoint(sample, box, props);
    if (next === null) {
      cancel('boundary');
      return;
    }
    if (previous === null) return;
    for (const cell of pathGridSegment(previous, next, props)) {
      traced = true;
      props.onTraceMove?.(cell);
    }
    previous = next;
  };
  const move = (event: PointerEvent): void => {
    if (active !== event.pointerId || props.disabled === true) return;
    event.preventDefault();
    const clip = element()?.getBoundingClientRect();
    if (!clip) return;
    const box = bounds(clip);
    visitSamples(event, clip, (sample, inside) => {
      traceSample(sample, inside ? box : undefined);
      return capturedPointer() !== null;
    });
  };
  return {
    cancel,
    down(event: PointerEvent): void {
      if (
        active !== null ||
        props.onTraceStart === undefined ||
        !canStart(event, props)
      )
        return;
      const clip = element()?.getBoundingClientRect();
      const start = gridPoint(event, clip && bounds(clip), props);
      if (start === null) return;
      event.preventDefault();
      active = event.pointerId;
      previous = start;
      traced = false;
      element()?.setPointerCapture(event.pointerId);
      const index = focusStart(element(), start, props.columns);
      props.onTraceStart(index);
    },
    move,
    up(event: PointerEvent): void {
      if (active !== event.pointerId) return;
      move(event);
      const pointer = capturedPointer();
      if (pointer === null) return;
      if (!traced) {
        cancel('stationary');
        return;
      }
      active = null;
      element()?.releasePointerCapture(pointer);
      if (props.disabled !== true) props.onTraceEnd?.();
    },
    lost(event: PointerEvent): void {
      if (active === event.pointerId) cancel();
    },
  };
}

function traceState(options: { board: PathGridBoardProps }) {
  return {
    disabled: options.board.disabled === true,
    available: !!options.board.onTraceStart,
  };
}

function pathCells(board: PathGridBoardProps) {
  return Array.from({ length: board.rows * board.columns }, (_, index) => ({
    value: String(index),
    label: board.cellLabel(index),
    index,
  }));
}

const trace = definePrimitive({
  name: 'path-grid',
  options: { board: 'value' },
  state: traceState,
  sync: traceState,
  api: (context) => {
    function writable() {
      const board = context.options().board;
      if (board.disabled || !board.onTraceStart)
        throw new Error('This path is read-only.');
      return board;
    }
    function index(board: PathGridBoardProps, value: unknown) {
      const cell = pathCells(board).find(
        (cell) =>
          cell.value === value || cell.index === value || cell.label === value
      );
      if (!cell) throw new Error('Choose a cell on the current board.');
      return cell.index;
    }
    return {
      cells: () => pathCells(context.options().board),
      beginPath(value: unknown) {
        const board = writable();
        board.onTraceStart?.(index(board, value));
      },
      extendPath(value: unknown) {
        const board = writable();
        board.onTraceMove?.(index(board, value));
      },
      finishPath() {
        writable().onTraceEnd?.();
      },
      cancelPath() {
        writable().onTraceCancel?.('interrupted');
      },
      clearPathAt(value: unknown) {
        const board = writable();
        if (!board.onCellKey?.('Delete', index(board, value)))
          throw new Error('This board does not clear paths.');
      },
    };
  },
  agent: {
    actions: [
      'beginPath',
      'extendPath',
      'finishPath',
      'cancelPath',
      'clearPathAt',
    ],
    items: (api) => api.cells(),
    shown: (state) => state.available,
  },
  slots: (slot) => ({ root: slot({}) }),
});
export const { Root: TraceSurface } = createParts(trace, { root: 'div' });
