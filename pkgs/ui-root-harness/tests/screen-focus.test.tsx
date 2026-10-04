/** @jsxImportSource solid-js */
/**
 * Where the keyboard goes when one `ScreenBase` replaces another inside an
 * `AppFrame` (WCAG 2.4.3): onto the new screen's title, or back onto the
 * control it left a screen from.
 */

import { describe, expect, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client/app-frame';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { screen } from '@solidjs/testing-library';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { renderUi } from './render';

const COMPACT = { width: 390, height: 800 };

type At = 'a' | 'b';

function Screen(props: { id: At; controls: readonly string[] }): JSX.Element {
  return (
    <ScreenBase
      screenId={props.id}
      breadcrumbs={[{ name: `Screen ${props.id}` }]}
      content={() => (
        <div class="box">
          <For each={props.controls}>
            {(label) => <button type="button">{label}</button>}
          </For>
        </div>
      )}
    />
  );
}

function mount(framed = true): (at: At) => Promise<void> {
  const [at, setAt] = createSignal<At>('a');
  const screens = (): JSX.Element => (
    <>
      <button type="button">Tab bar</button>
      <Show
        when={at() === 'a'}
        fallback={<Screen id="b" controls={['B1', 'B2']} />}
      >
        <Screen id="a" controls={['A1', 'A2']} />
      </Show>
    </>
  );
  renderUi(
    () => (framed ? <AppFrame>{screens()}</AppFrame> : screens()),
    COMPACT
  );
  return async (next) => {
    setAt(next);
    await Promise.resolve();
  };
}

function focus(name: string): void {
  screen.getByRole('button', { name }).focus();
}

function keyboardOn(): string {
  const active = document.activeElement;
  if (active === null || active === document.body) return 'nothing';
  return `${active.tagName.toLowerCase()} ${active.textContent}`;
}

describe('screen focus', () => {
  test('the first screen leaves the keyboard alone', () => {
    mount();
    expect(keyboardOn()).toBe('nothing');
  });

  // regression: a11y-focus-lost-on-navigation
  test("a screen replacing the keyboard's screen takes it on its title", async () => {
    const go = mount();
    focus('A2');
    await go('b');
    expect(keyboardOn()).toBe('h1 Screen b');
  });

  test('coming back puts the keyboard on the control it left from', async () => {
    const go = mount();
    focus('A2');
    await go('b');
    focus('B1');
    await go('a');
    expect(keyboardOn()).toBe('button A2');
  });

  test('a change that leaves the keyboard on lasting chrome does not move it', async () => {
    const go = mount();
    focus('Tab bar');
    await go('b');
    expect(keyboardOn()).toBe('button Tab bar');
  });

  test('outside an AppFrame, screens manage no focus', async () => {
    const go = mount(false);
    focus('A2');
    await go('b');
    expect(keyboardOn()).toBe('nothing');
  });
});
