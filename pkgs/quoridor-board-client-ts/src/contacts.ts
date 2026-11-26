import type { BoardCamera, Point } from './board-camera';

import { wallAtPoint } from './wall-at-point';

export type BoardInput = {
  readonly interactive: boolean;
  readonly tool: 'h' | 'v' | 'move';
  readonly pawn: string;
  readonly direct: boolean;
  onWallPreview(wall: string | null): void;
  onWall(wall: string): void;
  onIllegalPawn(): void;
  onDrop(cell: string): void;
  onPreview(cell: string | null): void;
};

type Grip = {
  origin: Point;
  cell: HTMLElement | null;
  dragged: boolean;
  wall: boolean;
};
const point = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export class BoardContacts {
  private readonly points = new Map<number, Point>();
  private grip: Grip | null = null;
  private navigation = false;
  suppressClick = false;
  constructor(
    private readonly camera: BoardCamera,
    private readonly input: BoardInput
  ) {}

  down(e: PointerEvent): void {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    const cell = e.target.closest<HTMLElement>('[data-cell]');
    this.points.set(e.pointerId, point(e));
    if (this.points.size === 1) {
      this.suppressClick = false;
      const wall =
        this.input.interactive && this.input.direct
          ? wallAtPoint(this.camera.board, point(e))
          : null;
      this.grip = {
        origin: point(e),
        cell,
        dragged: false,
        wall: wall !== null,
      };
      if (wall !== null) this.input.onWallPreview(wall);
    } else {
      this.navigation = true;
      this.suppressClick = true;
      this.clearGrip();
    }
    // Capture on the originating target so a stationary contact keeps its native click.
    if (e.isTrusted) e.target.setPointerCapture(e.pointerId);
  }

  private cellAt(p: Point): HTMLElement | null {
    const board = this.camera.board;
    const target = board.ownerDocument
      .elementFromPoint(p.x, p.y)
      ?.closest<HTMLElement>('[data-cell]');
    return target && board.contains(target) ? target : null;
  }

  move(e: PointerEvent): void {
    const prev = this.points.get(e.pointerId);
    if (!prev) return;
    const next = point(e);
    this.points.set(e.pointerId, next);
    const other = [...this.points].find(([id]) => id !== e.pointerId)?.[1];
    if (other) {
      if (this.points.size === 2)
        this.camera.move(
          middle(prev, other),
          middle(next, other),
          distance(next, other) / Math.max(1, distance(prev, other))
        );
      return;
    }
    if (
      !this.navigation &&
      this.grip &&
      !this.grip.dragged &&
      distance(next, this.grip.origin) < 8
    )
      return;
    this.suppressClick = true;
    if (this.navigation || this.camera.scale > 1) {
      this.navigation = true;
      this.camera.move(prev, next, 1);
    } else this.drag(next);
  }

  private drag(p: Point): void {
    const grip = this.grip;
    if (!grip) return;
    grip.dragged = true;
    if (!this.input.interactive) return;
    if (grip.wall) {
      this.input.onWallPreview(wallAtPoint(this.camera.board, p));
    } else if (this.input.tool !== 'move') {
      this.input.onPreview(this.cellAt(p)?.dataset['cell'] ?? null);
    } else if (grip.cell?.dataset['cell'] === this.input.pawn) {
      grip.cell.dataset['lifted'] = 'true';
      grip.cell.style.setProperty('--lift-x', p.x - grip.origin.x + 'px');
      grip.cell.style.setProperty('--lift-y', p.y - grip.origin.y + 'px');
    }
  }

  up(e: PointerEvent): void {
    const grip = this.grip;
    if (!this.points.has(e.pointerId)) return;
    this.move(e);
    const wall =
      !this.navigation && grip?.wall && this.input.interactive
        ? wallAtPoint(this.camera.board, point(e))
        : null;
    if (grip?.wall) this.suppressClick = true;
    const drop =
      !grip?.wall &&
      !this.navigation &&
      grip?.dragged &&
      this.input.interactive &&
      (this.input.tool !== 'move' ||
        grip.cell?.dataset['cell'] === this.input.pawn);
    const cell = drop ? this.cellAt(point(e)) : null;
    this.points.delete(e.pointerId);
    if (!this.points.size) this.navigation = false;
    this.clearGrip();
    const id = cell?.dataset['cell'];
    if (wall !== null) this.input.onWall(wall);
    else if (id && cell?.getAttribute('aria-disabled') === 'false')
      this.input.onDrop(id);
    else if (drop && cell) this.input.onIllegalPawn();
    else if (
      this.input.direct &&
      this.input.interactive &&
      !this.suppressClick &&
      grip?.cell &&
      grip.cell.dataset['cell'] !== this.input.pawn &&
      grip.cell.getAttribute('aria-disabled') === 'true'
    )
      this.input.onIllegalPawn();
  }

  lost(e: PointerEvent): void {
    if (this.points.has(e.pointerId)) this.cancel();
  }

  cancel(): void {
    if (this.points.size) this.suppressClick = true;
    this.points.clear();
    this.navigation = false;
    this.clearGrip();
  }

  private clearGrip(): void {
    const cell = this.grip?.cell;
    if (cell) {
      delete cell.dataset['lifted'];
      cell.style.removeProperty('--lift-x');
      cell.style.removeProperty('--lift-y');
    }
    if (this.grip?.wall) this.input.onWallPreview(null);
    if (this.grip?.dragged || this.navigation) this.input.onPreview(null);
    this.grip = null;
  }
}
