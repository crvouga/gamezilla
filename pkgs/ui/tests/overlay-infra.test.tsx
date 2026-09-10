/** @jsxImportSource solid-js */
import {
  FadeSwitch,
  FocusTrap,
  KeyboardShortcutScope,
  OverlayPortal,
  OverlayPortalProvider,
  SURFACE_STACK_BASE,
  SURFACE_STACK_STEP,
  SurfaceStackProvider,
  SurfaceStackSlot,
  useDocumentShortcuts,
  useIsTopSurface,
} from '@pkgs/ui';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, renderUi } from './support/render';

describe('FocusTrap', () => {
  test('autofocuses, wraps Tab, restores focus, escapes innermost', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    const [open, setOpen] = createSignal(true);
    renderUi(() => (
      <>
        <button
          class="clickable clickableTint"
          data-testid="outside"
          type="button"
        >
          out
        </button>
        <FocusTrap active={open()} onEscape={onEscape} label="Dialog">
          <button class="clickable clickableTint" data-testid="a" type="button">
            a
          </button>
          <button class="clickable clickableTint" data-testid="b" type="button">
            b
          </button>
        </FocusTrap>
      </>
    ));
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toHaveAttribute(
      'aria-modal',
      'true'
    );
    expect(screen.getByTestId('a')).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('b')).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('a')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByTestId('b')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
    setOpen(false);
  });
});

describe('keyboard shortcuts', () => {
  function Listener(props: {
    enabled: boolean;
    onKey: () => void;
  }): JSX.Element {
    useDocumentShortcuts({
      enabled: () => props.enabled,
      onKeyDown: (ev) => {
        if (ev.key === 'k' && (ev.metaKey || ev.ctrlKey)) {
          props.onKey();
          return true;
        }
        return undefined;
      },
    });
    return <p class="text">{'l'}</p>;
  }

  test('document listener respects scope gate', async () => {
    const user = userEvent.setup();
    const onKey = vi.fn();
    const [active, setActive] = createSignal(false);
    renderUi(() => (
      <KeyboardShortcutScope active={active()}>
        <Listener enabled onKey={onKey} />
      </KeyboardShortcutScope>
    ));
    await user.keyboard('{Control>}k{/Control}');
    expect(onKey).not.toHaveBeenCalled();
    setActive(true);
    await user.keyboard('{Control>}k{/Control}');
    expect(onKey).toHaveBeenCalledTimes(1);
  });
});

describe('OverlayPortal', () => {
  test('teleports children into the host layer', () => {
    renderUi(() => (
      <OverlayPortalProvider>
        <p class="text">{'page'}</p>
        <OverlayPortal>
          <p class="text" data-testid="f">
            {'floating'}
          </p>
        </OverlayPortal>
      </OverlayPortalProvider>
    ));
    const host = screen
      .getByTestId('f')
      .closest('[data-component="OverlayPortalHost"]');
    if (host === null) throw new Error('not portaled into the overlay host');
    expect(cssOf(host)).toContain('z-index:1000000');
    // Host must carry `.boxNone` (pointer-events: none + children auto) so the
    // absolute fill never blocks the app underneath when empty.
    expect([...host.classList].some((c) => c.includes('boxNone'))).toBe(true);
  });

  test('renders inline without a provider', () => {
    renderUi(() => (
      <OverlayPortal>
        <p class="text">{'inline'}</p>
      </OverlayPortal>
    ));
    expect(screen.getByText('inline')).toBeInTheDocument();
  });
});

describe('SurfaceStack', () => {
  function Top(props: { id: string }): JSX.Element {
    const isTop = useIsTopSurface(() => props.id);
    return <p class="text">{`${props.id}:${isTop() ? 'top' : 'under'}`}</p>;
  }

  test('z-index follows open order and isTop tracks the last surface', () => {
    const [second, setSecond] = createSignal(false);
    renderUi(() => (
      <SurfaceStackProvider>
        <Top id="one" />
        <Top id="two" />
        <SurfaceStackSlot id="one" visible>
          <p class="text">{'one'}</p>
        </SurfaceStackSlot>
        <SurfaceStackSlot id="two" visible={second()}>
          <p class="text">{'two'}</p>
        </SurfaceStackSlot>
      </SurfaceStackProvider>
    ));
    const layerOne = screen.getByText('one').parentElement as Element;
    expect(cssOf(layerOne)).toContain(`z-index:${SURFACE_STACK_BASE}`);
    expect(screen.getByText('one:top')).toBeInTheDocument();

    setSecond(true);
    const layerTwo = screen.getByText('two').parentElement as Element;
    expect(cssOf(layerTwo)).toContain(
      `z-index:${SURFACE_STACK_BASE + SURFACE_STACK_STEP}`
    );
    expect(screen.getByText('one:under')).toBeInTheDocument();
    expect(screen.getByText('two:top')).toBeInTheDocument();

    setSecond(false);
    expect(screen.queryByText('two')).toBeNull();
    expect(screen.getByText('one:top')).toBeInTheDocument();
  });

  test('FadeSwitch exposes the state key', () => {
    renderUi(() => (
      <FadeSwitch stateKey="ready" dataSet={{ testid: 'fs' }}>
        <p class="text">{'x'}</p>
      </FadeSwitch>
    ));
    expect(screen.getByTestId('fs')).toHaveAttribute('data-state-key', 'ready');
  });
});
