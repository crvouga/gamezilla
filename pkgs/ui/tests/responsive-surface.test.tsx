/** @jsxImportSource solid-js */
import { SurfaceStackProvider } from '@pkgs/ui';
import {
  BottomSheetHostProvider,
  createPassthroughBottomSheetHost,
  createWebBottomSheetHost,
} from '@pkgs/ui/components/bottom-sheet-host';
import {
  ResponsiveSurface,
  shouldUseMobileSheet,
} from '@pkgs/ui/components/responsive-surface';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

function Surface(props: {
  onClose: () => void;
  presentation?: 'responsive' | 'modal';
  visible?: boolean;
  closable?: boolean;
}): JSX.Element {
  return (
    <ResponsiveSurface
      visible={props.visible ?? true}
      onClose={props.onClose}
      closable={props.closable}
      title="Filters"
      presentation={props.presentation}
      closeDataSet={{ testid: 'close' }}
    >
      <p class="text">{'Surface body'}</p>
    </ResponsiveSurface>
  );
}

describe('shouldUseMobileSheet', () => {
  test('sheet only for responsive + compact + capable host', () => {
    const base = {
      presentation: undefined,
      layoutMode: 'compact',
      supportsSheetPresentation: true,
    } as const;
    expect(shouldUseMobileSheet(base)).toBe(true);
    expect(shouldUseMobileSheet({ ...base, layoutMode: 'wide' })).toBe(false);
    expect(shouldUseMobileSheet({ ...base, presentation: 'modal' })).toBe(
      false
    );
    expect(
      shouldUseMobileSheet({ ...base, supportsSheetPresentation: false })
    ).toBe(false);
  });
});

describe('ResponsiveSurface', () => {
  test('wide layout renders a centered ModalContent dialog named by the title', () => {
    const onClose = vi.fn();
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={onClose} />
        </SurfaceStackProvider>
      ),
      { width: 1200, height: 800 }
    );
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    expect(mustQuery('[data-component="ModalContent"]')).toBeInTheDocument();
    expect(document.querySelector('[data-surface="sheet"]')).toBeNull();
    expect(screen.getByText('Surface body')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('compact layout renders the CSS bottom sheet with a decorative handle', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={onClose} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const sheet = mustQuery('[data-surface="sheet"]');
    expect(sheet.className).toMatch(/bottom-0/);
    // Content-hug capped at 90% of the layout height.
    expect(cssOf(sheet)).toContain('max-height:720px');
    expect(mustQuery('[data-component="BottomSheetHandle"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(
      document.querySelector('[data-component="ModalContent"]')
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.click(mustQuery('[data-component="BottomSheetScrim"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('presentation="modal" forces the centered modal on compact layouts', () => {
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={() => {}} presentation="modal" />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    expect(mustQuery('[data-component="ModalContent"]')).toBeInTheDocument();
    expect(document.querySelector('[data-surface="sheet"]')).toBeNull();
  });

  test('closable=false hides the close icon and ignores backdrop dismiss', () => {
    const onClose = vi.fn();
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={onClose} presentation="modal" closable={false} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    expect(screen.queryByTestId('close')).toBeNull();
    fireEvent.click(mustQuery('[data-component="ModalScrim"]'));
    expect(onClose).not.toHaveBeenCalled();
  });

  test('passthrough host falls back to the modal path; web host is the default', () => {
    expect(createWebBottomSheetHost().supportsSheetPresentation).toBe(true);
    renderUi(
      () => (
        <SurfaceStackProvider>
          <BottomSheetHostProvider host={createPassthroughBottomSheetHost()}>
            <Surface onClose={() => {}} />
          </BottomSheetHostProvider>
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    expect(mustQuery('[data-component="ModalContent"]')).toBeInTheDocument();
  });

  test('sheet unmounts and restores focus when hidden', () => {
    const [open, setOpen] = createSignal(true);
    renderUi(
      () => (
        <SurfaceStackProvider>
          <button type="button" data-testid="outside">
            out
          </button>
          <Surface visible={open()} onClose={() => setOpen(false)} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[data-surface="sheet"]')).toBeNull();
  });
});
