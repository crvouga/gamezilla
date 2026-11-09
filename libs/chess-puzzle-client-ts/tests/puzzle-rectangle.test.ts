import { expect, test } from 'bun:test';
import { puzzleRectangle } from '@libs/chess-puzzle-client-ts/puzzle-rectangle.example';

/** Synthetic rectangles isolate coordinate conversion, not browser layout. */
function fixture() {
  const outer = document.createElement('div');
  const canvas = document.createElement('div');
  outer.append(canvas);
  const position = { left: 102, top: 121, width: 584 };
  for (let index = 0; index < 64; index++) {
    const cell = document.createElement('button');
    cell.dataset['square'] = `${index}`;
    cell.getBoundingClientRect = () => {
      const size = position.width / 8;
      return new DOMRect(
        position.left +
          (index % 8) * size -
          outer.scrollLeft -
          canvas.scrollLeft,
        position.top +
          Math.floor(index / 8) * size -
          outer.scrollTop -
          canvas.scrollTop,
        size,
        size
      );
    };
    canvas.append(cell);
  }
  return { outer, canvas, position };
}

// regression: chess-puzzle-scroll-misreported-as-layout-shift
test('the 768px Retry trace preserves a 584px board when scrolling its top from 121 to 84', () => {
  const { outer, canvas } = fixture();
  const before = puzzleRectangle(canvas);
  outer.scrollTop = 20;
  canvas.scrollTop = 17;
  const after = puzzleRectangle(canvas);
  expect(before.viewport.top).toBe(121);
  expect(after.viewport.top).toBe(84);
  expect(after.top).toBe(before.top);
  expect(after.width).toBe(584);
  expect(after.height).toBe(584);
  expect(after.scrollTop).toBe(37);
});

test('nested horizontal scrolling does not masquerade as a board relocation', () => {
  const { outer, canvas } = fixture();
  const before = puzzleRectangle(canvas);
  outer.scrollLeft = 11;
  canvas.scrollLeft = 6;
  expect(puzzleRectangle(canvas).left).toBe(before.left);
});

test('real five-pixel layout movement remains detectable after scrolling', () => {
  const { outer, canvas, position } = fixture();
  const before = puzzleRectangle(canvas);
  outer.scrollTop = 37;
  position.top += 5;
  expect(puzzleRectangle(canvas).top - before.top).toBe(5);
});

test('real board resizing remains detectable after scrolling', () => {
  const { outer, canvas, position } = fixture();
  const before = puzzleRectangle(canvas);
  outer.scrollTop = 37;
  position.width += 8;
  const after = puzzleRectangle(canvas);
  expect(after.width - before.width).toBe(8);
  expect(after.height - before.height).toBe(8);
});
