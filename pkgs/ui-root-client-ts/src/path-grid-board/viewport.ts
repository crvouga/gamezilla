import { createSignal } from 'solid-js';
import type {
  createPathGridPointer,
  PathGridBoardProps,
} from '../path-grid-pointer';

type Point = { x: number; y: number };
const fit = { x: 0, y: 0, scale: 1 };
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(n, high));

function camera() {
  let view = fit;
  const [transform, setTransform] = createSignal('none');
  function change(from: Point, to: Point, ratio: number) {
    const scale = clamp(view.scale * ratio, 1, 4);
    const factor = scale / view.scale;
    const x = clamp(to.x - (from.x - view.x) * factor, 1 - scale, 0);
    const y = clamp(to.y - (from.y - view.y) * factor, 1 - scale, 0);
    view = { x, y, scale };
    setTransform(
      scale === 1
        ? 'none'
        : `translate(${100 * x}%, ${100 * y}%) scale(${scale})`
    );
  }
  return {
    transform,
    change,
    view: () => view,
    reset() {
      view = fit;
      setTransform('none');
    },
  };
}

function contactGeometry(points: Map<number, Point>, box: DOMRect) {
  const [first, second = first] = points.values();
  if (!first || !second) return null;
  return {
    center: {
      x: ((first.x + second.x) / 2 - box.left) / box.width,
      y: ((first.y + second.y) / 2 - box.top) / box.height,
    },
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

function navigationKeys(
  view: ReturnType<typeof camera>,
  event: KeyboardEvent,
  point: Point
) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key === '0') view.reset();
  else if (['+', '=', '-'].includes(event.key))
    view.change(point, point, event.key === '-' ? 0.5 : 2);
  else return false;
  event.preventDefault();
  return true;
}

function emptyStart(board: PathGridBoardProps, event: PointerEvent) {
  if (!(event.target instanceof Element)) return false;
  const button = event.target.closest('[data-cell]');
  if (!button) return false;
  const cell = Number(button.getAttribute('data-cell'));
  return (
    !board.endpoints.some((endpoint) => endpoint.cell === cell) &&
    !board.lines.some((line) => line.cells.includes(cell))
  );
}

export function createBoardViewport(
  board: PathGridBoardProps,
  root: () => HTMLDivElement | undefined
) {
  const view = camera();
  const points = new Map<number, Point>();
  let navigating = false;
  const enabled = () => board.onTraceStart !== undefined && !board.disabled;
  function release(id: number) {
    points.delete(id);
    if (!points.size) navigating = false;
  }
  function cancelContacts() {
    points.clear();
    navigating = false;
  }
  function move(event: PointerEvent) {
    if (!points.has(event.pointerId)) return false;
    if (!navigating) {
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      return false;
    }
    const box = root()?.getBoundingClientRect();
    if (!box) return false;
    const old = contactGeometry(points, box);
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!old) return navigating;
    const next = contactGeometry(points, box);
    if (next)
      view.change(
        old.center,
        next.center,
        old.distance && next.distance ? next.distance / old.distance : 1
      );
    return true;
  }
  function center(cell: number) {
    const v = view.view();
    return {
      x: v.x + (((cell % board.columns) + 0.5) / board.columns) * v.scale,
      y:
        v.y + ((Math.floor(cell / board.columns) + 0.5) / board.rows) * v.scale,
    };
  }
  return {
    ...view,
    emptyStart: (e: PointerEvent) =>
      view.view().scale > 1 && emptyStart(board, e),
    enabled,
    points,
    release,
    cancelContacts,
    move,
    navigating: () => navigating,
    inspect() {
      navigating = true;
    },
    key(event: KeyboardEvent, cell: number) {
      return enabled() && navigationKeys(view, event, center(cell));
    },
    reveal(cell: number) {
      const scale = view.view().scale;
      if (scale === 1) return;
      const point = center(cell);
      const marginX = Math.min(0.5, scale / (2 * board.columns));
      const marginY = Math.min(0.5, scale / (2 * board.rows));
      view.change(
        point,
        {
          x: clamp(point.x, marginX, 1 - marginX),
          y: clamp(point.y, marginY, 1 - marginY),
        },
        1
      );
    },
    bounds(box: DOMRect) {
      if (view.view().scale === 1) return box;
      return (
        root()?.querySelector('[data-plane]')?.getBoundingClientRect() ?? box
      );
    },
  };
}

type Viewport = ReturnType<typeof createBoardViewport>;
type Trace = ReturnType<typeof createPathGridPointer>;

function wheelNavigation(
  view: Viewport,
  trace: Trace,
  root: () => HTMLDivElement | undefined
) {
  return (e: WheelEvent) => {
    if (!view.enabled() || (!e.ctrlKey && view.view().scale === 1)) return;
    const box = root()?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    trace.cancel('interrupted', true);
    if (view.points.size) view.inspect();
    const p = {
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    };
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? box.height : 1;
    if (e.ctrlKey) view.change(p, p, Math.exp(-e.deltaY * unit * 0.01));
    else
      view.change(
        p,
        {
          x: p.x - (e.deltaX * unit) / box.width,
          y: p.y - (e.deltaY * unit) / box.height,
        },
        1
      );
  };
}

function doubleTap(view: Viewport, root: () => HTMLDivElement | undefined) {
  let last: { time: number; point: Point } | undefined;
  let start: Point | undefined;
  function moved(e: PointerEvent) {
    return !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4;
  }
  return {
    begin(e: PointerEvent) {
      start = { x: e.clientX, y: e.clientY };
    },
    move(e: PointerEvent) {
      if (moved(e)) start = undefined;
    },
    cancel() {
      start = undefined;
      last = undefined;
    },
    end(e: PointerEvent) {
      const box = root()?.getBoundingClientRect();
      if (!start || moved(e) || !box) {
        last = undefined;
        return;
      }
      if (
        last &&
        e.timeStamp - last.time < 350 &&
        Math.hypot(e.clientX - last.point.x, e.clientY - last.point.y) < 16
      ) {
        const p = {
          x: (e.clientX - box.left) / box.width,
          y: (e.clientY - box.top) / box.height,
        };
        view.change(p, p, view.view().scale === 1 ? 2 : 1 / view.view().scale);
        last = undefined;
      } else last = { time: e.timeStamp, point: start };
      start = undefined;
    },
  };
}

export function boardNavigation(
  view: Viewport,
  trace: Trace,
  root: () => HTMLDivElement | undefined
) {
  const taps = doubleTap(view, root);
  function down(e: PointerEvent) {
    if (!view.enabled() || (e.button !== 0 && e.button !== 1)) {
      trace.down(e);
      return;
    }
    view.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const multi = view.points.size > 1 || e.button === 1 || view.navigating();
    if (multi) taps.cancel();
    else taps.begin(e);
    if (multi || view.emptyStart(e)) {
      trace.cancel('interrupted', true);
      view.inspect();
      root()?.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else trace.down(e);
  }
  return {
    down,
    up(e: PointerEvent) {
      if (!view.navigating()) trace.up(e);
      if (view.points.has(e.pointerId)) taps.end(e);
      view.release(e.pointerId);
    },
    move(e: PointerEvent) {
      taps.move(e);
      if (!view.move(e)) trace.move(e);
    },
    lost(e: PointerEvent) {
      trace.lost(e);
      if (view.points.has(e.pointerId)) taps.cancel();
      view.release(e.pointerId);
    },
    outside(e: PointerEvent) {
      const board = root();
      if (
        !board ||
        e.pointerType !== 'touch' ||
        !view.points.size ||
        e.composedPath().includes(board)
      )
        return;
      trace.cancel('interrupted', true);
      taps.cancel();
      view.inspect();
    },
    wheel: wheelNavigation(view, trace, root),
  };
}
