/** @jsxImportSource @solidjs/web */

import { expect, test } from 'bun:test';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, flush, Show } from 'solid-js';
import { renderUi } from './render';

// README rule 11: an alert that comes and goes floats over the screen, so
// nothing in the page's flow moves when it appears or clears; its close puts
// it away until the alert changes.
test('an alert floats outside the page, never changes it, and closes until it changes', () => {
  const [away, setAway] = createSignal(false);
  renderUi(() => (
    <div data-testid="page">
      <ToastStack>
        <Show when={away()}>
          <Notice tone="info">The host is offline.</Notice>
        </Show>
      </ToastStack>
      <p>Board</p>
    </div>
  ));
  const page = screen.getByTestId('page');
  const before = page.innerHTML;
  const stack = () => document.querySelector('[data-component="ToastStack"]');
  expect(stack()).toBeNull();
  setAway(true);
  flush();
  expect(stack()?.getAttribute('role')).toBe('region');
  expect(stack()?.getAttribute('aria-live')).toBe('polite');
  expect(page.contains(stack())).toBe(false);
  expect(stack()?.textContent).toContain('The host is offline.');
  expect(page.innerHTML).toBe(before);
  fireEvent.click(screen.getByTestId('toast-dismiss'));
  expect(stack()).toBeNull();
  setAway(false);
  flush();
  setAway(true);
  flush();
  expect(stack()).not.toBeNull();
});
