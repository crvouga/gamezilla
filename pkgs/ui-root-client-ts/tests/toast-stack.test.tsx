import { afterEach, expect, test } from 'bun:test';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import { cleanup, render } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';

afterEach(cleanup);

// README rule 11: an alert that comes and goes floats over the screen, so
// nothing in the page's flow moves when it appears or clears.
test('an alert floats outside the page, and the page is unchanged by it', () => {
  const [away, setAway] = createSignal(false);
  const view = render(() => (
    <div data-testid="page">
      <ToastStack>
        <Show when={away()}>
          <p>The host is offline.</p>
        </Show>
      </ToastStack>
      <p>Board</p>
    </div>
  ));
  const page = view.getByTestId('page');
  const before = page.innerHTML;
  expect(document.querySelector('[data-component="ToastStack"]')).toBeNull();
  setAway(true);
  const stack = document.querySelector('[data-component="ToastStack"]');
  expect(stack).not.toBeNull();
  expect(stack?.getAttribute('role')).toBe('region');
  expect(stack?.getAttribute('aria-live')).toBe('polite');
  expect(page.contains(stack)).toBe(false);
  expect(stack?.textContent).toContain('The host is offline.');
  expect(page.innerHTML).toBe(before);
  setAway(false);
  expect(document.querySelector('[data-component="ToastStack"]')).toBeNull();
});
