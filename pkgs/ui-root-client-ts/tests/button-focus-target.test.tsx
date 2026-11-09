/** @jsxImportSource solid-js */
/** `Button` accepts a focus target like `Pressable` and `TextInput`. */

import { expect, test } from 'bun:test';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { createFocusTarget } from '@pkgs/ui-root-client-ts/focus';
import { render } from '@solidjs/testing-library';
import { createSignal, Index, Show } from 'solid-js';

function byTestId(testId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`
  );
  if (element === null) throw new Error(`no element ${testId}`);
  return element;
}

test('a focus target follows whichever button holds it and lets go on unmount', () => {
  const [pressed, setPressed] = createSignal(0);
  const [shown, setShown] = createSignal(true);
  const target = createFocusTarget();
  const view = render(() => (
    <Show when={shown()}>
      <Index each={['first', 'second']}>
        {(name, index) => (
          <Button
            title={name()}
            dataSet={{ testid: name() }}
            focusTarget={pressed() === index ? target.target : undefined}
          />
        )}
      </Index>
    </Show>
  ));
  expect(target.focus()).toBe(true);
  expect(document.activeElement).toBe(byTestId('first'));
  setPressed(1);
  expect(target.focus()).toBe(true);
  expect(document.activeElement).toBe(byTestId('second'));
  setShown(false);
  expect(target.mounted()).toBe(false);
  expect(target.focus()).toBe(false);
  view.unmount();
});

test('a button without a focus target renders as before', () => {
  const view = render(() => (
    <Button title="Plain" dataSet={{ testid: 'plain' }} />
  ));
  const button = byTestId('plain');
  expect(button.tagName).toBe('BUTTON');
  expect(button.getAttribute('type')).toBe('button');
  view.unmount();
});
