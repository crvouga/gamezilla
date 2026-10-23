/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { TabStrip } from '@pkgs/ui-devtools-client-ts/tab-strip';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

function mustAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

describe('TabStrip', () => {
  test('tablist/tab roles, aria-selected, select + close', () => {
    const onSelect = mock();
    const onClose = mock();
    renderUi(() => (
      <TabStrip
        aria-label="Apps"
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two', onClose },
        ]}
        selectedId="one"
        onSelect={onSelect}
      />
    ));
    expect(screen.getByRole('tablist', { name: 'Apps' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(mustAt(tabs, 1));
    expect(onSelect).toHaveBeenCalledWith('two');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
