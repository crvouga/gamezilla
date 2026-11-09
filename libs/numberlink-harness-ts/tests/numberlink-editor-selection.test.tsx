import { expect, test } from 'bun:test';
import { fireEvent } from '@solidjs/testing-library';
import { editorFixture } from './numberlink-client-fixture';

// regression: numberlink-editor-endpoint-selection-invisible
test('the editor identifies the selected endpoint and updates its location after placement', () => {
  const f = editorFixture();
  try {
    const selected = () =>
      f.view
        .getByTestId('numberlink-board')
        .querySelector('[aria-current="true"]');
    expect(selected()?.getAttribute('data-cell')).toBe('0');
    expect(
      f.view.getByTestId('numberlink-placement-target').textContent
    ).toContain('A1');
    fireEvent.click(f.view.getByRole('radio', { name: 'Second endpoint' }));
    expect(selected()?.getAttribute('data-cell')).toBe('2');
    expect(
      f.view.getByTestId('numberlink-placement-target').textContent
    ).toContain('C1');
    fireEvent.click(f.view.getByRole('button', { name: 'B1: empty' }));
    expect(f.board().pairs[0]?.endpoints[1]).toEqual({ x: 1, y: 0 });
    expect(selected()?.getAttribute('data-cell')).toBe('0');
    expect(
      f.view.getByTestId('numberlink-placement-target').textContent
    ).toContain('A1');
  } finally {
    f.view.unmount();
  }
});
