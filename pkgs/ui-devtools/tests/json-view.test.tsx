/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { JsonView } from '@pkgs/ui-devtools';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './support/render';

const VALUE = {
  name: 'Ada',
  tags: ['a', 'b'],
  nested: { deep: { n: 1 } },
};

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`missing item ${index}`);
  return item;
}

function expandedButtons(): HTMLElement[] {
  return [...document.querySelectorAll('button[aria-expanded]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  );
}

describe('JsonView', () => {
  test('renders a tree with the root expanded to depth 1', () => {
    renderUi(() => <JsonView value={VALUE} hideToolbar />);
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.getByText('"name":')).toBeInTheDocument();
    expect(screen.getByText('"Ada"')).toBeInTheDocument();
    // depth-1 containers are collapsed: summary visible, children hidden.
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.queryByText('"deep":')).toBeNull();
    const root = expandedButtons()[0];
    expect(root).toHaveAttribute('aria-expanded', 'true');
  });

  test('container rows are <button aria-expanded> and toggle children', () => {
    renderUi(() => <JsonView value={VALUE} hideToolbar />);
    const nested = expandedButtons().find((b) =>
      b.textContent.includes('"nested":')
    );
    if (nested === undefined) throw new Error('nested row missing');
    expect(nested).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(nested);
    expect(nested).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('"deep":')).toBeInTheDocument();
    fireEvent.click(nested);
    expect(screen.queryByText('"deep":')).toBeNull();
  });

  test('toolbar expand all / collapse all / reset', () => {
    renderUi(() => <JsonView value={VALUE} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('"n":')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('"name":')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('"name":')).toBeInTheDocument();
    expect(screen.queryByText('"n":')).toBeNull();
  });

  test('copy affordances only appear with an injected copy sink', () => {
    renderUi(() => (
      <JsonView value={VALUE} dataSet={{ component: 'NoCopy' }} />
    ));
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(
      screen.queryAllByRole('button', { name: 'Copy value' })
    ).toHaveLength(0);
  });

  test('copy sink receives pretty JSON for the root and raw text for leaves', () => {
    const copy = mock((_text: string) => Promise.resolve());
    renderUi(() => <JsonView value={VALUE} copy={copy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(copy).toHaveBeenCalledWith(JSON.stringify(VALUE, null, 2));
    const rowCopies = screen.getAllByRole('button', { name: 'Copy value' });
    // Row order: root, name, tags, nested → second button is the "name" leaf.
    fireEvent.click(nth(rowCopies, 1));
    expect(copy).toHaveBeenLastCalledWith('Ada');
  });

  test('scalars render as a single leaf with a disabled toolbar', () => {
    renderUi(() => <JsonView value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(expandedButtons()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeDisabled();
  });
});
