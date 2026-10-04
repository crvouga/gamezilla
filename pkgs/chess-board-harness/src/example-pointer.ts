import { squareCenter } from '@pkgs/chess-board-core-shared/geometry';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { ExampleConfig } from './example-config';

export type ExampleInputArgs = {
  host: HTMLElement;
  config: () => ExampleConfig;
  touched: () => void;
};
export function createPointerInputs(args: ExampleInputArgs) {
  function point(
    type: string,
    x: number,
    y: number,
    input: { pointerType?: string; button?: number } = {}
  ) {
    const pointerType = input.pointerType ?? 'mouse';
    const button = input.button ?? 0;
    args.touched();
    args.host.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType,
        button,
        buttons: type === 'pointerup' ? 0 : button === 2 ? 2 : 1,
        clientX: x,
        clientY: y,
      })
    );
  }
  function center(square: Square) {
    return squareCenter(
      square,
      args.host.getBoundingClientRect().width,
      args.config().orientation ?? 'white'
    );
  }
  function pointer(
    type: string,
    square: Square,
    pointerType = 'mouse',
    button = 0
  ) {
    const at = center(square);
    point(type, at.x, at.y, { pointerType, button });
  }
  return {
    pointer,
    lift(square: Square) {
      const at = center(square);
      point('pointermove', at.x + 10, at.y);
    },
    tap(square: Square) {
      pointer('pointerdown', square);
      pointer('pointerup', square);
    },
    dropOutside() {
      point('pointermove', -100, -100);
      point('pointerup', -100, -100);
    },
    dropAtRatio(xRatio: number, yRatio: number) {
      const size = args.host.getBoundingClientRect().width;
      point('pointermove', xRatio * size, yRatio * size);
      point('pointerup', xRatio * size, yRatio * size);
    },
  };
}
