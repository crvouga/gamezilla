import { expect, test } from 'bun:test';
import { playerFixture } from './numberlink-client-fixture';

// regression: numberlink-identical-refresh-cancels-drawing
test('an identical incoming snapshot keeps the provisional keyboard path', () => {
  const f = playerFixture();
  try {
    const first = f.view.getByTestId('numberlink-board-cell-0');
    first.focus();
    first.click();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    f.refreshState();
    expect(
      f.view.getByTestId('numberlink-board-cell-1').getAttribute('aria-label')
    ).toContain('path 1, unfinished');
    f.view
      .getByTestId('numberlink-board-cell-1')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    f.view.getByTestId('numberlink-board-cell-2').click();
    expect(f.actions).toHaveLength(1);
  } finally {
    f.view.unmount();
  }
});
