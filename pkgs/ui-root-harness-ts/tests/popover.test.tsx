/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { Popover } from '@pkgs/ui-root-client-ts/popover';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { renderUi } from './render';

function Harness(props: {
  onOpenChange?: (open: boolean) => void;
}): JSX.Element {
  return (
    <SurfaceStackProvider>
      <Popover
        label="Filters"
        onOpenChange={props.onOpenChange}
        testId="filters"
        trigger={(trigger) => (
          <Pressable {...trigger} testId="trigger">
            <Text>{'Filters'}</Text>
          </Pressable>
        )}
      >
        <button type="button">{'Apply'}</button>
      </Popover>
      <button type="button" data-testid="outside">
        {'Elsewhere'}
      </button>
    </SurfaceStackProvider>
  );
}

const trigger = () => screen.getByTestId('trigger');
const dialog = () => screen.queryByRole('dialog', { name: 'Filters' });

describe('Popover', () => {
  test('the trigger announces a dialog popup and its state', async () => {
    const user = userEvent.setup();
    renderUi(() => <Harness />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).not.toHaveAttribute('aria-controls');
    expect(dialog()).toBeNull();
    await user.click(trigger());
    const panel = dialog();
    expect(panel).not.toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', panel?.id ?? '');
    expect(
      panel?.closest('[data-component="SurfaceStackHost"]')
    ).not.toBeNull();
    // Non-modal: no aria-modal, floats with the one shadow.
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(panel?.className).toMatch(/\bshadow-float\b/);
    expect(panel?.className).toMatch(/\bbg-surface-overlay\b/);
    expect(panel?.className).toMatch(/\brounded-card\b/);
  });

  test('focus moves in on open and back to the trigger on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = mock((_open: boolean) => undefined);
    renderUi(() => <Harness onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Apply' })
    );
    await user.keyboard('{Escape}');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([
      true,
      false,
    ]);
  });

  test('the trigger toggles it closed', async () => {
    const user = userEvent.setup();
    renderUi(() => <Harness />);
    await user.click(trigger());
    await user.click(trigger());
    expect(dialog()).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  test('a press outside closes it; a press inside does not', async () => {
    const user = userEvent.setup();
    renderUi(() => <Harness />);
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(dialog()).not.toBeNull();
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(dialog()).toBeNull();
  });

  test('controlled open follows the owner', () => {
    const [open, setOpen] = createSignal(true);
    renderUi(() => (
      <SurfaceStackProvider>
        <Popover
          label="Owned"
          open={open()}
          onOpenChange={setOpen}
          trigger={(t) => (
            <Pressable {...t}>
              <Text>{'Owned'}</Text>
            </Pressable>
          )}
        >
          <Text>{'Body'}</Text>
        </Popover>
      </SurfaceStackProvider>
    ));
    expect(screen.getByRole('dialog', { name: 'Owned' })).toBeTruthy();
    setOpen(false);
    expect(screen.queryByRole('dialog', { name: 'Owned' })).toBeNull();
  });
});
