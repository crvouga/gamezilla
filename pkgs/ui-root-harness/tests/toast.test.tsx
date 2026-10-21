/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { type ToastApi, useToast } from '@pkgs/ui-root-client/toast';
import { ToastProvider } from '@pkgs/ui-root-client/toast-provider';
import { TOAST_EXIT_MS } from '@pkgs/ui-root-shared/toast-queue';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { mustQuery, renderUi } from './render';

function mount(options: { width?: number } = {}) {
  let api: ToastApi | undefined;
  function Capture(): JSX.Element {
    api = useToast();
    return null;
  }
  const rendered = renderUi(
    () => (
      <ToastProvider>
        <Capture />
      </ToastProvider>
    ),
    options
  );
  if (api === undefined) throw new Error('no toast api');
  return { ...rendered, toast: api };
}

const toasts = () => document.querySelectorAll('[data-component="Toast"]');

describe('Toast', () => {
  test('a polite status by default, an alert when destructive', () => {
    const { toast } = mount();
    toast.show({ message: 'Link copied' });
    toast.show({
      message: 'Could not save',
      description: 'Try again.',
      tone: 'destructive',
    });
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('alert')).toHaveTextContent('Try again.');
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-tone',
      'destructive'
    );
  });

  test('leaves after 4000ms by default, then animates out', () => {
    const { toast, clock } = mount();
    toast.show({ message: 'Saved' });
    clock.advance(3999);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'open');
    clock.advance(1);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'leaving');
    clock.advance(TOAST_EXIT_MS);
    expect(toasts()).toHaveLength(0);
  });

  test('hover and focus pause the countdown and keep the time left', () => {
    const { toast, clock } = mount();
    toast.show({ message: 'Saved', duration: 1000 });
    const card = mustQuery('[data-component="Toast"]');
    clock.advance(600);
    fireEvent.mouseEnter(card);
    clock.advance(5000);
    expect(card).toHaveAttribute('data-state', 'open');
    fireEvent.mouseLeave(card);
    clock.advance(399);
    expect(card).toHaveAttribute('data-state', 'open');
    fireEvent.focusIn(card);
    clock.advance(5000);
    expect(card).toHaveAttribute('data-state', 'open');
    fireEvent.focusOut(card);
    clock.advance(1);
    expect(card).toHaveAttribute('data-state', 'leaving');
  });

  test('at most three stack; the oldest is pushed out', () => {
    const { toast } = mount();
    for (const message of ['One', 'Two', 'Three', 'Four'])
      toast.show({ message });
    expect(Array.from(toasts()).map((t) => t.textContent)).toEqual([
      'Two',
      'Three',
      'Four',
    ]);
  });

  test('the action runs and dismisses; dismiss(id) removes early', () => {
    const { toast, clock } = mount();
    const undo = mock();
    toast.show({
      message: 'Archived',
      action: { label: 'Undo', onPress: undo },
    });
    const id = toast.show({ message: 'Other' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    toast.dismiss(id);
    clock.advance(TOAST_EXIT_MS);
    expect(toasts()).toHaveLength(0);
  });

  test('bottom-center on compact, bottom-start on wide', () => {
    const { unmount } = mount({ width: 390 });
    expect(mustQuery('[data-component="ToastViewport"]').className).toMatch(
      /\bitems-center\b/
    );
    unmount();
    mount({ width: 1280 });
    expect(mustQuery('[data-component="ToastViewport"]').className).toMatch(
      /\bitems-start\b/
    );
  });

  test('useToast outside a provider throws', () => {
    function Orphan(): JSX.Element {
      useToast();
      return null;
    }
    expect(() => renderUi(() => <Orphan />)).toThrow('ToastProvider missing');
  });
});
