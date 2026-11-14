/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AppStage } from '@pkgs/ui-devtools-client-ts/app-stage';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

function mount(start = 'alice') {
  const mounts: Record<string, number> = {};
  const onTap = mock();
  const [shown, setShown] = createSignal<string | null>(start);
  const view = (id: string, live: boolean) => ({
    id,
    title: id,
    live,
    content: () => {
      mounts[id] = (mounts[id] ?? 0) + 1;
      return <p>{`${id} app`}</p>;
    },
  });
  const ui = renderUi(() => (
    <AppStage
      aria-label="Devices"
      shown={shown()}
      views={[view('alice', true), view('bob', true), view('logs', false)]}
      handle={{ label: 'Next device', onTap }}
    />
  ));
  const handle = screen.getByRole('button', { name: 'Next device' });
  return { ...ui, mounts, onTap, setShown, handle };
}

const shownViews = (): (string | null)[] =>
  [...document.querySelectorAll('[data-view-shown="true"]')].map((element) =>
    element.getAttribute('data-view-id')
  );

describe('AppStage', () => {
  test('shows one view, keeps live views mounted and mounts the rest when shown', () => {
    const { mounts, setShown } = mount();
    expect(shownViews()).toEqual(['alice']);
    expect(mounts).toEqual({ alice: 1, bob: 1 });

    setShown('logs');
    expect(shownViews()).toEqual(['logs']);
    expect(mounts).toEqual({ alice: 1, bob: 1, logs: 1 });

    // Back and forth mounts nothing a second time.
    setShown('bob');
    setShown('logs');
    expect(mounts).toEqual({ alice: 1, bob: 1, logs: 1 });
    expect(screen.getByText('alice app')).toBeInTheDocument();
  });

  test('a press switches, however long it is held: it is a switcher and nothing else', () => {
    const { handle, onTap, clock } = mount();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { button: 0, pointerId: 1 });
    expect(onTap).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(handle, { button: 0, pointerId: 2 });
    clock.advance(5000);
    expect(onTap).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(handle, { button: 0, pointerId: 2 });
    expect(onTap).toHaveBeenCalledTimes(2);
    // It opens nothing, so it says it opens nothing.
    expect(handle).not.toHaveAttribute('aria-haspopup');
    expect(handle).not.toHaveAttribute('aria-expanded');
  });

  test('a drag moves the handle and is not a press', () => {
    const { handle, onTap } = mount();
    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 300,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120, clientY: 200 });
    expect(handle).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 120, clientY: 200 });
    expect(handle).toHaveAttribute('data-dragging', 'false');
    expect(onTap).not.toHaveBeenCalled();
  });

  test('Enter and Space switch; no other key and no second click does', () => {
    const { handle, onTap } = mount();
    fireEvent.keyDown(handle, { key: 'Enter' });
    fireEvent.keyDown(handle, { key: ' ' });
    expect(onTap).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'Enter', repeat: true });
    // The click a pointer or a key also makes does not switch again.
    fireEvent.click(handle);
    expect(onTap).toHaveBeenCalledTimes(2);
  });

  test('with no handle given there is none: one view, edge to edge, and nothing over it', () => {
    renderUi(() => (
      <AppStage
        aria-label="Devices"
        shown="only"
        views={[{ id: 'only', title: 'only', content: () => <p>only app</p> }]}
      />
    ));
    expect(shownViews()).toEqual(['only']);
    expect(document.querySelector('[data-stage-part="handle"]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
