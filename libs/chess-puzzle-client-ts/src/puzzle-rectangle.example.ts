/** Board layout coordinates, independent of scrolling to reach nearby controls. */
export function puzzleRectangle(canvas: HTMLElement) {
  const cells = [
    ...canvas.querySelectorAll<HTMLElement>('button[data-square]'),
  ];
  if (cells.length !== 64)
    throw new Error('Expected the complete chess puzzle board');
  const bounds = cells.map((cell) => cell.getBoundingClientRect());
  const left = Math.min(...bounds.map((rect) => rect.left));
  const top = Math.min(...bounds.map((rect) => rect.top));
  let scrollTop = 0;
  let scrollLeft = 0;
  for (
    let parent = cells[0]?.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    scrollTop += parent.scrollTop;
    scrollLeft += parent.scrollLeft;
  }
  return {
    left: left + scrollLeft,
    top: top + scrollTop,
    viewport: { left, top },
    width: Math.max(...bounds.map((rect) => rect.right)) - left,
    height: Math.max(...bounds.map((rect) => rect.bottom)) - top,
    scrollTop,
    scrollLeft,
  };
}
