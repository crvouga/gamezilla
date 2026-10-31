/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { BottomSheetHostProvider } from '@pkgs/ui-root-client-ts/context';
import { createPassthroughBottomSheetHost } from '@pkgs/ui-root-client-ts/passthrough';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { shouldUseMobileSheet } from '@pkgs/ui-root-client-ts/should-use-mobile-sheet';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { createWebBottomSheetHost } from '@pkgs/ui-root-client-ts/web-bottom-sheet';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

function Surface(props: {
  onClose: () => void;
  presentation?: 'responsive' | 'modal';
  visible?: boolean;
  closable?: boolean;
  scroll?: boolean;
}): JSX.Element {
  return (
    <ResponsiveSurface
      visible={props.visible ?? true}
      onClose={props.onClose}
      closable={props.closable}
      title="Filters"
      presentation={props.presentation}
      scroll={props.scroll}
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
    const onClose = mock();
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
    const onClose = mock();
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
    // Raised fill, 20px top radius, the float shadow (no hairline), safe-area
    // inset, rises in.
    expect(sheet.className).toMatch(/\bbg-surface-elevated\b/);
    expect(sheet.className).toMatch(/\brounded-t-sheet\b/);
    expect(sheet.className).toMatch(/\bshadow-float\b/);
    expect(sheet.className).not.toMatch(/\bborder\b/);
    expect(sheet.className).toMatch(/\bsafeBottom\b/);
    expect(sheet.className).toMatch(/\bsheetEnter\b/);
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

  test('scroll={false} keeps the surface fixed without a chrome ScrollView', () => {
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={() => {}} presentation="modal" scroll={false} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 600 }
    );
    expect(mustQuery('[data-component="ModalContent"]')).toBeInTheDocument();
    expect(document.querySelector('[data-component="ScrollView"]')).toBeNull();
    expect(screen.getByText('Surface body')).toBeInTheDocument();
  });

  test('default scroll pins the header and scrolls only the body', () => {
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={() => {}} presentation="modal" />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 600 }
    );
    const scrollContent = mustQuery('[data-component="ScrollViewContent"]');
    expect(scrollContent).toBeInTheDocument();
    expect(scrollContent).toHaveTextContent('Surface body');
    expect(scrollContent).not.toHaveTextContent('Filters');
    const header = mustQuery('[data-component="ResponsiveSurfaceHeader"]');
    expect(header).toHaveTextContent('Filters');
    expect(scrollContent.contains(header)).toBe(false);
    const chrome = mustQuery('[data-component="ResponsiveSurfaceChrome"]');
    expect(chrome.contains(header)).toBe(true);
    // Scrollbar is flush: chrome has no edge padding; padding is on content.
    expect(chrome.className).not.toMatch(/\bpx-4\b/);
    expect(chrome.className).not.toMatch(/\bpb-6\b/);
    expect(
      mustQuery('[data-component="ResponsiveSurfaceHeaderPad"]').className
    ).toMatch(/\bpx-4\b/);
    expect(scrollContent.className).toMatch(/\bpx-ui-lg\b/);
    expect(scrollContent.className).toMatch(/\bpb-ui-xl\b/);
    // `.surfaceScrollShell`: a grid of `auto` header over `minmax(0, 1fr)`.
    expect(chrome.className).toMatch(/\bsurfaceScrollShell\b/);
    expect(cssOf(chrome)).toMatch(/max-height:\d+px/);
    const scroller = mustQuery('[data-component="ScrollView"]');
    expect(chrome.contains(scroller)).toBe(true);
    expect(scroller.contains(header)).toBe(false);
    expect(scroller.className).toMatch(/\bh-full\b/);
  });

  test('overflowing body keeps header outside the scrollport', () => {
    renderUi(
      () => (
        <SurfaceStackProvider>
          <ResponsiveSurface
            visible
            onClose={() => {}}
            title="Filters"
            presentation="modal"
          >
            <div data-testid="tall-body" style={{ height: '2000px' }}>
              Tall body
            </div>
          </ResponsiveSurface>
        </SurfaceStackProvider>
      ),
      { width: 400, height: 360 }
    );
    const header = mustQuery('[data-component="ResponsiveSurfaceHeader"]');
    const scroller = mustQuery('[data-component="ScrollView"]');
    const scrollContent = mustQuery('[data-component="ScrollViewContent"]');
    expect(scroller.contains(header)).toBe(false);
    expect(scrollContent).toHaveTextContent('Tall body');
    expect(scrollContent).not.toHaveTextContent('Filters');
    // Grid + height:100% is what makes overflow:auto engage in the browser.
    expect(
      mustQuery('[data-component="ResponsiveSurfaceChrome"]').className
    ).toMatch(/\bsurfaceScrollShell\b/);
    expect(scroller.className).toMatch(/\bh-full\b/);
    expect(scrollContent.className).toMatch(/\bpx-ui-lg\b/);
  });

  test('scroll={false} keeps shell edge padding for nested flush scrollers', () => {
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={() => {}} presentation="modal" scroll={false} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 600 }
    );
    const chrome = mustQuery('[data-component="ResponsiveSurfaceChrome"]');
    expect(chrome.className).toMatch(/\bpx-4\b/);
    expect(chrome.className).toMatch(/\bpb-6\b/);
    expect(
      document.querySelector('[data-component="ResponsiveSurfaceHeaderPad"]')
    ).toBeNull();
  });

  test('closable=false hides the close icon and ignores backdrop dismiss', () => {
    const onClose = mock();
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

  test('Escape closes the sheet and returns focus to the control that opened it', async () => {
    const user = userEvent.setup();
    const [open, setOpen] = createSignal(false);
    renderUi(
      () => (
        <SurfaceStackProvider>
          <button type="button" onClick={() => setOpen(true)}>
            {'Open filters'}
          </button>
          <Surface visible={open()} onClose={() => setOpen(false)} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    const opener = screen.getByRole('button', { name: 'Open filters' });
    await user.click(opener);
    expect(mustQuery('[data-surface="sheet"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(
      mustQuery('[data-surface="sheet"]').contains(document.activeElement)
    ).toBe(true);
    await user.keyboard('{Escape}');
    expect(document.querySelector('[data-surface="sheet"]')).toBeNull();
    expect(opener).toHaveFocus();
  });

  test('a scrim tap closes the sheet and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const [open, setOpen] = createSignal(false);
    renderUi(
      () => (
        <SurfaceStackProvider>
          <button type="button" onClick={() => setOpen(true)}>
            {'Open filters'}
          </button>
          <Surface visible={open()} onClose={() => setOpen(false)} />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    const opener = screen.getByRole('button', { name: 'Open filters' });
    await user.click(opener);
    fireEvent.click(mustQuery('[data-component="BottomSheetScrim"]'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  test('presentation="modal" is the dialog: centered, scrim, Escape closes', async () => {
    const user = userEvent.setup();
    const onClose = mock();
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Surface onClose={onClose} presentation="modal" />
        </SurfaceStackProvider>
      ),
      { width: 400, height: 800 }
    );
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    expect(mustQuery('[data-component="ModalScrim"]')).toHaveClass('bg-scrim');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
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
