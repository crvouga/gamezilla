/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AppStage } from '@pkgs/ui-devtools-client-ts/app-stage';
import { APP_STAGE_HOLD_MS } from '@pkgs/ui-devtools-client-ts/app-stage-handle';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

function mount(start = 'alice') {
  const mounts: Record<string, number> = {};
  const onTap = mock();
  const onHold = mock();
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
      handle={{
        label: 'Next device',
        text: 'al',
        expanded: false,
        onTap,
        onHold,
      }}
    />
  ));
  const handle = screen.getByRole('button', { name: 'Next device' });
  return { ...ui, mounts, onTap, onHold, setShown, handle };
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

  test('a press goes on; a hold asks for more and is not also a press', () => {
    const { handle, onTap, onHold, clock } = mount();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { button: 0, pointerId: 1 });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onHold).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, { button: 0, pointerId: 2 });
    clock.advance(APP_STAGE_HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(handle, { button: 0, pointerId: 2 });
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  test('a drag moves the handle and is neither a press nor a hold', () => {
    const { handle, onTap, onHold, clock } = mount();
    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 300,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120, clientY: 200 });
    expect(handle).toHaveAttribute('data-dragging', 'true');
    clock.advance(APP_STAGE_HOLD_MS);
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 120, clientY: 200 });
    expect(handle).toHaveAttribute('data-dragging', 'false');
    expect(onTap).not.toHaveBeenCalled();
    expect(onHold).not.toHaveBeenCalled();
  });

  test('the keyboard and the context menu reach both actions', () => {
    const { handle, onTap, onHold } = mount();
    fireEvent.keyDown(handle, { key: 'Enter' });
    fireEvent.keyDown(handle, { key: ' ' });
    expect(onTap).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.contextMenu(handle);
    expect(onHold).toHaveBeenCalledTimes(2);
    // The click a pointer or a key also makes does not go on again.
    fireEvent.click(handle);
    expect(onTap).toHaveBeenCalledTimes(2);
  });
});
