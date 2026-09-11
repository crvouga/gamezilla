/** @jsxImportSource solid-js */
import {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
} from '@pkgs/ui/components/dismissible-top-banner';
import { EmptyState } from '@pkgs/ui/components/empty-state';
import { ErrorState } from '@pkgs/ui/components/error-state';
import { LoadingState } from '@pkgs/ui/components/loading-state';
import { ProgressBar } from '@pkgs/ui/components/progress-bar';
import { Skeleton } from '@pkgs/ui/components/skeleton';
import {
  SPIN_DURATION_MS,
  Spinner,
  SpinnerBox,
  SpinnerProvider,
} from '@pkgs/ui/components/spinner';
import { StateBlock } from '@pkgs/ui/components/state-block';
import { SuccessState } from '@pkgs/ui/components/success-state';
import { Tooltip } from '@pkgs/ui/components/tooltip';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, Show } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

function mustParent(el: Element): HTMLElement {
  const parent = el.parentElement;
  if (parent === null) throw new Error('detached element');
  return parent;
}

describe('Spinner', () => {
  test('renders role=status with a live label and sized svg', () => {
    renderUi(() => <Spinner size="small" data-testid="s" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('aria-label', 'Loading…');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(cssOf(el)).toContain('width:24px');
  });

  test('shares rotation phase through SpinnerProvider via animation-delay', () => {
    const { clock } = renderUi(() => {
      const [n, setN] = createSignal(0);
      return (
        <SpinnerProvider>
          <button type="button" onClick={() => setN(n() + 1)}>
            add
          </button>
          <Show when={n() > 0}>
            <Spinner />
          </Show>
        </SpinnerProvider>
      );
    });
    clock.advance(300);
    fireEvent.click(screen.getByText('add'));
    const el = screen.getByRole('status');
    expect(cssOf(el)).toContain(`animation-delay:-${300 % SPIN_DURATION_MS}ms`);
  });

  test('SpinnerBox centers a spinner with optional caption', () => {
    renderUi(() => (
      <SpinnerBox dataSet={{ testid: 'box' }}>
        <span>Loading entity…</span>
      </SpinnerBox>
    ));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading entity…')).toBeInTheDocument();
  });
});

describe('Skeleton + ProgressBar', () => {
  test('Skeleton is decorative and sized', () => {
    renderUi(() => <Skeleton width={120} height={12} />);
    const el = mustQuery('[data-component="Skeleton"]');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(cssOf(el)).toContain('width:120px');
  });

  test('ProgressBar exposes progressbar semantics and clamps', () => {
    renderUi(() => <ProgressBar progress={1.4} label="Upload" />);
    const bar = screen.getByRole('progressbar', { name: 'Upload' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '1');
  });

  test('indeterminate ProgressBar omits aria-valuenow', () => {
    renderUi(() => <ProgressBar indeterminate label="Busy" />);
    const bar = screen.getByRole('progressbar', { name: 'Busy' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });
});

describe('State blocks', () => {
  test('StateBlock fill vs compact layout', () => {
    renderUi(() => (
      <>
        <StateBlock variant="fill" dataSet={{ testid: 'fill' }}>
          <span>a</span>
        </StateBlock>
        <StateBlock variant="compact" dataSet={{ testid: 'compact' }}>
          <span>b</span>
        </StateBlock>
      </>
    ));
    const fill = mustQuery('[data-testid="fill"]');
    const compact = mustQuery('[data-testid="compact"]');
    expect(cssOf(fill)).toContain('flex-grow:1');
    expect(cssOf(compact)).not.toContain('flex-grow:1');
  });

  test('LoadingState renders spinner + caption', () => {
    renderUi(() => <LoadingState caption="Waiting for metrics…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Waiting for metrics…')).toBeInTheDocument();
  });

  test('EmptyState renders title/body and fires the action', () => {
    const onClick = vi.fn();
    renderUi(() => (
      <EmptyState
        title="No spaces yet"
        body="Create one to get started."
        action={{ label: 'Create space', onClick }}
      />
    ));
    expect(screen.getByText('No spaces yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('SuccessState renders as a status region with an action', () => {
    const onClick = vi.fn();
    renderUi(() => (
      <SuccessState title="Saved" action={{ label: 'Continue', onClick }} />
    ));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('ErrorState is an alert, retries, and copies the message', async () => {
    const retry = vi.fn();
    const copy = vi.fn(async (_text: string) => {});
    const { clock } = renderUi(() => (
      <ErrorState
        title="Failed to load"
        body="boom"
        retry={{ label: 'Retry', onClick: retry }}
        copy={copy}
      />
    ));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
    await Promise.resolve();
    expect(copy).toHaveBeenCalledWith('Failed to load\nboom');
    expect(
      await screen.findByRole('button', { name: 'Copied' })
    ).toBeInTheDocument();
    clock.advance(2000);
    expect(screen.getByRole('button', { name: 'Copy error' })).toBeVisible();
  });
});

describe('Tooltip', () => {
  test('shows on hover, hides on leave, and describes the trigger', () => {
    renderUi(() => (
      <Tooltip label="Settings">
        <button type="button">gear</button>
      </Tooltip>
    ));
    const bubble = screen.getByRole('tooltip', { hidden: true });
    expect(bubble).toHaveAttribute('aria-hidden', 'true');
    const anchor = mustParent(bubble);
    fireEvent.pointerEnter(anchor);
    fireEvent.mouseEnter(anchor);
    expect(bubble).not.toHaveAttribute('aria-hidden');
    fireEvent.pointerLeave(anchor);
    fireEvent.mouseLeave(anchor);
    expect(bubble).toHaveAttribute('aria-hidden', 'true');
  });

  test('shows on keyboard focus-visible when enableFocus is on', async () => {
    const user = userEvent.setup();
    renderUi(() => (
      <Tooltip label="Help" enableFocus>
        <button type="button">?</button>
      </Tooltip>
    ));
    const bubble = screen.getByRole('tooltip', { hidden: true });
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: '?' })
    );
    expect(bubble).not.toHaveAttribute('aria-hidden');
    fireEvent.focusOut(screen.getByRole('button', { name: '?' }));
    expect(bubble).toHaveAttribute('aria-hidden', 'true');
  });

  test('pins horizontally via static placement (no JS shift)', () => {
    renderUi(() => (
      <Tooltip label="Account menu" placement="bottom-end">
        <button type="button">me</button>
      </Tooltip>
    ));
    const bubble = screen.getByRole('tooltip', { hidden: true });
    expect(bubble.className).toMatch(/end/);
    expect(bubble.className).toMatch(/bottom/);
    expect(bubble.className).not.toMatch(/center/);
  });
});

describe('DismissibleBanner', () => {
  test('renders into the in-flow portal host, dismisses, and fires the action', () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    renderUi(() => (
      <DismissibleBannerPortalProvider>
        <p data-testid="body">{'body'}</p>
        <DismissibleBanner
          visible
          onDismiss={onDismiss}
          title="Update available"
          actionLabel="Reload"
          onActionClick={onAction}
        />
      </DismissibleBannerPortalProvider>
    ));
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Update available');
    // Default tone is paper (`bg-surface-overlay`) on the sheet frame.
    expect(banner.innerHTML).toMatch(/bg-surface-overlay/);
    const host = banner.closest(
      '[data-component="DismissibleBannerPortalHost"]'
    );
    if (host === null) throw new Error('banner not in portal host');
    expect(host.getAttribute('data-position')).toBe('top');
    // In-flow: host is a prior sibling of the app body, not an absolute overlay.
    expect(host.compareDocumentPosition(screen.getByTestId('body'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(banner.className).not.toMatch(/\babsolute\b/);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('is not rendered while hidden', () => {
    renderUi(() => (
      <DismissibleBannerPortalProvider>
        <DismissibleBanner visible={false} onDismiss={() => {}} title="x" />
      </DismissibleBannerPortalProvider>
    ));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
