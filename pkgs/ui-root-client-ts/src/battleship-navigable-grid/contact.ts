import { contactFrame, type Point } from './camera';

export type ShipDrag = {
  preview: (cell: string | null) => void;
  drop: (cell: string) => void;
};
type Ports = {
  cellAt: (p: Point) => string | null;
  pickup: (cell: string) => ShipDrag | undefined;
  navigate: (from: Point, to: Point, factor: number) => void;
  magnified: () => boolean;
};

export function contactGesture(ports: Ports) {
  const points = new Map<number, Point>();
  let origin: Point | null = null;
  let startCell: string | null = null;
  let drag: ShipDrag | undefined;
  let navigation = false;
  let moved = false;
  const discard = () => {
    drag?.preview(null);
    drag = undefined;
    navigation = true;
    moved = true;
  };
  const down = (id: number, point: Point, cell: string | null) => {
    if (!points.size) {
      origin = point;
      startCell = cell;
      navigation = ports.magnified();
      moved = false;
    } else discard();
    points.set(id, point);
  };
  const move = (id: number, point: Point) => {
    if (!points.has(id) || !origin) return;
    const before = contactFrame(points);
    points.set(id, point);
    const after = contactFrame(points);
    if (!before || !after) return;
    if (!moved && Math.hypot(point.x - origin.x, point.y - origin.y) < 6)
      return;
    if (!moved && !navigation && startCell) drag = ports.pickup(startCell);
    moved = true;
    if (navigation)
      ports.navigate(
        before.center,
        after.center,
        before.span && after.span ? after.span / before.span : 1
      );
    else drag?.preview(ports.cellAt(point));
  };
  const up = (id: number, point: Point) => {
    if (!points.has(id)) return;
    move(id, point);
    points.delete(id);
    if (!navigation && drag) {
      const cell = ports.cellAt(point);
      if (cell) drag.drop(cell);
    }
    drag?.preview(null);
    drag = undefined;
  };
  return {
    down,
    move,
    up,
    active: (id: number) => points.has(id),
    suppressClick: () => moved,
    cancel: () => {
      if (points.size) discard();
      points.clear();
    },
  };
}
