export type Point = { x: number; y: number };
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/** Translation is measured in screen pixels from the fitted board's top left. */
export class BoardCamera {
  scale = 1;
  private x = 0;
  private y = 0;
  constructor(
    private readonly host: HTMLElement,
    readonly board: HTMLElement,
    private readonly onZoom: (zoomed: boolean) => void
  ) {}

  private origin(): Point {
    const box = this.host.getBoundingClientRect();
    return {
      x: box.left + this.board.offsetLeft,
      y: box.top + this.board.offsetTop,
    };
  }

  center(): Point {
    const origin = this.origin();
    return {
      x: origin.x + this.board.offsetWidth / 2,
      y: origin.y + this.board.offsetHeight / 2,
    };
  }

  resize(): void {
    const left = this.board.offsetLeft;
    this.host.style.setProperty('--board-left', left + 'px');
    this.host.style.setProperty(
      '--board-right',
      Math.max(0, this.host.clientWidth - left - this.board.offsetWidth) + 'px'
    );
    this.paint();
  }

  /** Keep the board point under the previous midpoint beneath the new one. */
  move(from: Point, to: Point, factor: number): void {
    const origin = this.origin();
    const scale = clamp(this.scale * factor, 1, 3);
    const ratio = scale / this.scale;
    this.x = to.x - origin.x - (from.x - origin.x - this.x) * ratio;
    this.y = to.y - origin.y - (from.y - origin.y - this.y) * ratio;
    this.scale = scale;
    this.paint();
  }

  fit(): void {
    this.scale = 1;
    this.paint();
  }

  private paint(): void {
    this.x = clamp(this.x, (1 - this.scale) * this.board.offsetWidth, 0);
    this.y = clamp(this.y, (1 - this.scale) * this.board.offsetHeight, 0);
    this.board.style.transform =
      this.scale === 1
        ? ''
        : `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    this.onZoom(this.scale > 1);
    this.host.dataset['zoomed'] = String(this.scale > 1);
  }
}
