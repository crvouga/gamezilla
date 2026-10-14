import { expect, test } from 'bun:test';
import { PuzzleScreen } from '@pkgs/ui-root-client/puzzle-screen';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

// regression: ui-puzzle-invalid-board-ratio
test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  'invalid board ratio %s is refused instead of producing invalid CSS',
  (ratio) => {
    let message = '';
    try {
      renderUi(() => (
        <PuzzleScreen screenId="invalid" boardAspectRatio={ratio}>
          <p>Board</p>
        </PuzzleScreen>
      ));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe('Board aspect ratio must be finite and positive');
  }
);

test('rectangular boards update without remounting and own their overlays and controls', () => {
  const [ratio, setRatio] = createSignal(1);
  const view = renderUi(() => (
    <PuzzleScreen
      screenId="puzzle"
      boardAspectRatio={ratio()}
      header={<p>Feed</p>}
      timeline={<button type="button">Back one move</button>}
      actions={<button type="button">Next puzzle</button>}
      overlay={<p role="status">Solved</p>}
    >
      <input aria-label="Board" />
    </PuzzleScreen>
  ));
  const board = view.getByRole('textbox');
  const fitted = () =>
    view.container.querySelector<HTMLElement>(
      '[style*="--ui-play-aspect-ratio"]'
    );
  expect(fitted()?.style.getPropertyValue('--ui-play-aspect-ratio')).toBe('1');
  setRatio(7 / 6);
  expect(fitted()?.style.getPropertyValue('--ui-play-aspect-ratio')).toBe(
    String(7 / 6)
  );
  expect(view.getByRole('textbox')).toBe(board);
  expect(
    fitted()?.contains(view.getByRole('button', { name: 'Next puzzle' }))
  ).toBe(false);
  expect(
    view.container
      .querySelector('[data-screen="puzzle"]')
      ?.contains(view.getByRole('status'))
  ).toBe(true);
});
