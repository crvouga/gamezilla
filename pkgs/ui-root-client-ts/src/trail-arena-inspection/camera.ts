type Point = { x: number; y: number };
export type ArenaCamera = Point & { zoom: number };
export const FIT: ArenaCamera = { x: 0, y: 0, zoom: 1 };
const CENTER = { x: 0.5, y: 0.5 };
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** Camera origins and pointer locations are fractions of the fitted drawing. */
export function inspectionCamera(paint: (camera: ArenaCamera) => void) {
  let view = FIT;
  const contacts = new Map<number, Point>();
  function move(from: Point, to: Point, factor: number) {
    const zoom = Math.max(1, Math.min(4, view.zoom * factor));
    const limit = 1 - 1 / zoom;
    view = {
      zoom,
      x: clamp(view.x + from.x / view.zoom - to.x / zoom, limit),
      y: clamp(view.y + from.y / view.zoom - to.y / zoom, limit),
    };
    paint(view);
  }
  function center() {
    const [a, b] = contacts.values();
    if (!a) return;
    if (!b) return a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return {
    move,
    scale: (factor: number) => move(CENTER, CENTER, factor),
    pan: (x: number, y: number) => move({ x, y }, { x: 0, y: 0 }, 1),
    fit() {
      contacts.clear();
      view = FIT;
      paint(view);
    },
    clear: () => contacts.clear(),
    start(id: number, point: Point) {
      if (contacts.size < 2) contacts.set(id, point);
    },
    drag(id: number, point: Point, aspect: number) {
      if (!contacts.has(id)) return;
      const before = center();
      // Measure physical finger separation, including the arena's aspect ratio.
      const pixelSpan = () => {
        const [a, b] = contacts.values();
        return a && b ? Math.hypot((a.x - b.x) * aspect, a.y - b.y) : 0;
      };
      const span = pixelSpan();
      contacts.set(id, point);
      const after = center();
      if (before && after)
        move(before, after, span > 0 ? pixelSpan() / span : 1);
    },
    end: (id: number) => contacts.delete(id),
  };
}
