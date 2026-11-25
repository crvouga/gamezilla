/** @jsxImportSource @solidjs/web */

import { describe, expect, mock, test } from 'bun:test';
import { TabStrip } from '@pkgs/ui-devtools-client-ts/tab-strip';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal } from 'solid-js';
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
    const close = document.querySelector<HTMLButtonElement>(
      '[data-component="TabStripClose"]'
    );
    if (!close) throw new Error('Missing pointer close target');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

// regression: ui-tab-close-controls-outside-aria-contract
test('Delete closes the focused tab and focus follows the remaining selected tab', () => {
  const [open, setOpen] = createSignal(true);
  renderUi(() => (
    <TabStrip
      aria-label="Drafts"
      selectedId={open() ? 'draft' : 'saved'}
      onSelect={() => undefined}
      items={
        open()
          ? [
              { id: 'draft', label: 'Draft', onClose: () => setOpen(false) },
              { id: 'saved', label: 'Saved' },
            ]
          : [{ id: 'saved', label: 'Saved' }]
      }
    />
  ));
  expect(
    screen.getByRole('button', { name: 'Close Draft' })
  ).not.toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('tablist', { name: 'Drafts' })).toHaveAttribute(
    'aria-owns',
    screen
      .getAllByRole('tab')
      .map((tab) => tab.id)
      .join(' ')
  );
  expect(
    screen.getByRole('button', { name: 'Close Draft' })
  ).toHaveAccessibleDescription('Draft');
  const tab = screen.getByRole('tab', { name: 'Draft' });
  tab.focus();
  fireEvent.keyDown(tab, { key: 'Delete' });
  expect(screen.queryByRole('tab', { name: 'Draft' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Saved' })).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Close Draft' })).toBeNull();
});

// regression: ui-tab-close-pending-focus-stolen
test('a pending close keeps focus in the caller confirmation', () => {
  const confirmation = () =>
    screen.getByRole('button', { name: 'Keep editing' });
  renderUi(() => (
    <>
      <TabStrip
        aria-label="Drafts"
        selectedId="draft"
        onSelect={() => undefined}
        items={[
          {
            id: 'draft',
            label: 'Draft',
            onClose: () => confirmation().focus(),
          },
        ]}
      />
      <Button title="Keep editing" />
    </>
  ));
  const tab = screen.getByRole('tab', { name: 'Draft' });
  tab.focus();
  fireEvent.keyDown(tab, { key: 'Delete' });
  expect(confirmation()).toHaveFocus();
  expect(tab).toBeInTheDocument();
});

test('an arrow selects the neighboring tab once and moves focus to it', () => {
  const [active, setActive] = createSignal('one');
  const choose = mock((id: string) => setActive(id));
  renderUi(() => (
    <TabStrip
      selectedId={active()}
      onSelect={choose}
      items={[
        { id: 'one', label: 'One' },
        { id: 'two', label: 'Two' },
      ]}
    />
  ));
  const first = screen.getByRole('tab', { name: 'One' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(choose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
});

test('an agent selects and closes the named document among open tabs', async () => {
  const [active, setActive] = createSignal('notes');
  const closeDraft = mock();
  const closeNotes = mock();
  renderUi(() => (
    <TabStrip
      aria-label="Open documents"
      selectedId={active()}
      onSelect={setActive}
      items={[
        { id: 'notes', label: 'Notes', onClose: closeNotes },
        { id: 'draft', label: 'Draft', onClose: closeDraft },
      ]}
    />
  ));
  const result = await createAgent().act({
    steps: [
      { ref: 'Open documents', action: 'select', args: ['Draft'] },
      { ref: 'Close Draft', action: 'press' },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  expect(screen.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(closeDraft).toHaveBeenCalledTimes(1);
  expect(closeNotes).not.toHaveBeenCalled();
});
