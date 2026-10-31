/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
  InFlowBanner,
} from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MutationError } from '@pkgs/ui-root-client-ts/mutation-modal-parts';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import {
  SPIN_DURATION_MS,
  SpinnerProvider,
} from '@pkgs/ui-root-client-ts/spinner-context';
import { StateBlock } from '@pkgs/ui-root-client-ts/state-block';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { Tooltip } from '@pkgs/ui-root-client-ts/tooltip';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, Show } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

function wrappingErrorMessage(): string {
  return 'The write did not land because the room locked the row and the detail keeps wrapping. '.repeat(
    12
  );
}

function readPx(value: string): number {
  if (value === '' || value === '0') return 0;
  if (!value.endsWith('px')) {
    throw new Error(`expected a px length, got ${value}`);
  }
  return Number.parseFloat(value);
}

/** The fixed state band MutationError already mounts around the error. */
function stateBand(retry: HTMLElement): HTMLElement {
  let node = retry.parentElement;
  while (node !== null) {
    if (
      node.style.height.endsWith('px') &&
      node.classList.contains('overflow-hidden')
    ) {
      return node;
    }
    node = node.parentElement;
  }
  throw new Error('mutation state band not found');
}

type RetryEdges = {
  retryTop: number;
  retryBottom: number;
  bandHeight: number;
  contentTop: number;
};

function bandColumn(band: HTMLElement): HTMLElement {
  const column = band.firstElementChild;
  if (!(column instanceof HTMLElement)) throw new Error('band has no error');
  if (column.getAttribute('role') !== 'alert') {
    throw new Error('band child is not the error alert');
  }
  if (column.style.height !== '100%' || column.style.overflow !== 'hidden') {
    throw new Error('error does not fill the band');
  }
  if (column.style.boxSizing !== 'border-box') {
    throw new Error('band padding is outside the fixed height');
  }
  if (column.style.display !== 'flex') throw new Error('error is not a column');
  if (column.style.flexDirection !== 'column') {
    throw new Error('error is not a column');
  }
  return column;
}

function pinnedHeight(node: HTMLElement, message: string): number {
  if (node.style.flexShrink !== '0') {
    throw new Error('retry slot can shrink out of the band');
  }
  if (node.textContent.includes(message.trim())) {
    throw new Error('wrapping message sits in the retry slot');
  }
  return readPx(node.style.minHeight);
}

function assertShrinkRegion(node: HTMLElement): void {
  if (node.style.minHeight !== '0' || node.style.overflow !== 'hidden') {
    throw new Error('message region cannot shrink inside the band');
  }
  if (!node.style.flex.startsWith('1')) {
    throw new Error('message region cannot shrink inside the band');
  }
  if (!node.textContent.includes('room locked the row')) {
    throw new Error('wrapping message is not in the shrinking region');
  }
}

/**
 * Bottom edge of the retry inside the band, from the layout the component
 * shipped (fixed band, shrinking message, non-shrinking retry slot).
 */
function retryEdges(
  band: HTMLElement,
  retry: HTMLElement,
  message: string
): RetryEdges {
  const column = bandColumn(band);
  const last = column.lastElementChild;
  if (!(last instanceof HTMLElement) || !last.contains(retry)) {
    throw new Error('retry is not the last row in the band');
  }
  const bandHeight = readPx(band.style.height);
  const contentTop = readPx(column.style.paddingTop);
  const contentHeight =
    bandHeight - contentTop - readPx(column.style.paddingBottom);
  let pinned = 0;
  let shrinks = 0;
  for (const node of column.children) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.contains(retry)) pinned += pinnedHeight(node, message);
    else {
      assertShrinkRegion(node);
      shrinks += 1;
    }
  }
  if (shrinks !== 1 || pinned <= 0) {
    throw new Error('retry is not pinned under a shrinking message');
  }
  const gap = readPx(column.style.gap) * (column.children.length - 1);
  if (pinned + gap > contentHeight) {
    throw new Error('pinned retry is taller than the band');
  }
  const retryBottom = bandHeight - readPx(column.style.paddingBottom);
  return {
    retryTop: retryBottom - pinned,
    retryBottom,
    bandHeight,
    contentTop,
  };
}

function mustParent(el: Element): HTMLElement {
  const parent = el.parentElement;
  if (parent === null) throw new Error('detached element');
  return parent;
}

describe('Spinner', () => {
  test('renders role=status with a live label and twelve petals', () => {
    renderUi(() => <Spinner size="sm" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('aria-label', 'Loading…');
    expect(el).toHaveAttribute('data-size', 'sm');
    expect(el.classList.contains('size-4')).toBe(true);
    const petals = [...el.querySelectorAll('rect')];
    expect(petals).toHaveLength(12);
    const opacities = petals.map((petal) =>
      Number(petal.getAttribute('opacity'))
    );
    expect(opacities[0]).toBe(1);
    expect(opacities).toEqual([...opacities].sort((a, b) => b - a));
  });

  test('defaults to md in the secondary text tone, and labels itself', () => {
    renderUi(() => <Spinner label="Loading puzzles" />);
    const el = screen.getByRole('status', { name: 'Loading puzzles' });
    expect(el.classList.contains('size-6')).toBe(true);
    expect(el.classList.contains('text-text-secondary')).toBe(true);
  });

  test('a decorative spinner is hidden from assistive tech', () => {
    renderUi(() => <Spinner decorative color="current" size="lg" />);
    expect(screen.queryByRole('status')).toBeNull();
    const el = mustQuery('[data-component="Spinner"]');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.classList.contains('size-10')).toBe(true);
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
    const svg = screen.getByRole('status').querySelector('svg');
    if (svg === null) throw new Error('spinner has no svg');
    expect(cssOf(svg)).toContain(
      `animation-delay:-${300 % SPIN_DURATION_MS}ms`
    );
  });
});

describe('Skeleton', () => {
  test('Skeleton is decorative and sized', () => {
    renderUi(() => <Skeleton width={120} height={12} />);
    const el = mustQuery('[data-component="Skeleton"]');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(cssOf(el)).toContain('width:120px');
    expect(el).toHaveClass('skeleton', 'bg-surface-muted', 'rounded-sm');
  });

  test('Skeleton shape picks a radius token, never a length', () => {
    renderUi(() => <Skeleton width={48} height={48} shape="circle" />);
    const el = mustQuery('[data-component="Skeleton"]');
    expect(el).toHaveClass('rounded-full');
    expect(cssOf(el)).not.toContain('border-radius');
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
    expect(fill).toHaveClass('flex-1');
    expect(fill).toHaveAttribute('data-variant', 'fill');
    expect(compact).not.toHaveClass('flex-1');
    expect(compact).toHaveAttribute('data-variant', 'compact');
  });

  test('LoadingState renders spinner + caption', () => {
    renderUi(() => <LoadingState caption="Waiting for metrics…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Waiting for metrics…')).toBeInTheDocument();
  });

  test('EmptyState renders title/body and fires the action', () => {
    const onClick = mock();
    renderUi(() => (
      <EmptyState
        title="No spaces yet"
        body="Create one to get started."
        action={{ label: 'Create space', onClick }}
      />
    ));
    expect(screen.getByText('No spaces yet')).toBeInTheDocument();
    expect(screen.getByText('Create one to get started.').className).toContain(
      'textBody'
    );
    const action = screen.getByRole('button', { name: 'Create space' });
    expect(action).toHaveAttribute('data-face', 'primary');
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('SuccessState renders as a status region with an action', () => {
    const onClick = mock();
    renderUi(() => (
      <SuccessState title="Saved" action={{ label: 'Continue', onClick }} />
    ));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('ErrorState is an alert, retries, and copies the message', async () => {
    const retry = mock();
    const copy = mock(async (_text: string) => {});
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

  test('retry is the primary face and a second recovery stays outline', () => {
    renderUi(() => (
      <ErrorState
        title="Could not save"
        body="The write did not land."
        retry={{ label: 'Try again', onClick: () => undefined }}
        secondary={{ label: 'Reload', onClick: () => undefined }}
      />
    ));
    const primary = screen.getByRole('button', { name: 'Try again' });
    const secondary = screen.getByRole('button', { name: 'Reload' });
    expect(primary).toHaveAttribute('data-face', 'primary');
    expect(primary).toHaveAttribute('data-intent', 'primary');
    expect(secondary).toHaveAttribute('data-face', 'neutral-outline');
    expect(secondary).toHaveAttribute('data-intent', 'neutral');
    expect(screen.getByRole('heading', { name: 'Could not save' })).toHaveClass(
      'textSubtitle'
    );
  });

  test('loading, empty, error, and success each render their state', () => {
    renderUi(() => (
      <>
        <LoadingState caption="Loading spaces…" />
        <EmptyState title="No spaces yet" body="Start one to play." />
        <ErrorState
          title="Could not load spaces"
          body="Check your connection and try again."
        />
        <SuccessState title="Space saved" />
      </>
    ));
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.getByText('Loading spaces…')).toBeInTheDocument();
    expect(screen.getByText('No spaces yet')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load spaces'
    );
    expect(screen.getByText('Space saved')).toBeInTheDocument();
  });

  test('MutationError keeps a wrapping message from pushing the retry out of the band', () => {
    const message = wrappingErrorMessage();
    renderUi(() => (
      <MutationError
        ids={{
          submitDataSet: undefined,
          cancelDataSet: undefined,
          successDataSet: undefined,
          dismissDataSet: undefined,
        }}
        labels={{
          submitLabel: 'Save',
          cancelLabel: 'Cancel',
          loadingLabel: 'Working',
          successTitle: 'Saved',
          successBody: 'Done',
          errorTitle: 'Could not save',
          dismissLabel: 'Done',
          retryLabel: 'Try again',
        }}
        error={new Error(message)}
        onRetry={() => undefined}
        onClose={() => undefined}
      />
    ));
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toHaveAttribute('data-face', 'primary');
    const band = stateBand(retry);
    const edges = retryEdges(band, retry, message);
    expect(edges.retryTop).toBeGreaterThanOrEqual(edges.contentTop);
    expect(edges.retryBottom).toBeLessThanOrEqual(edges.bandHeight);
    expect(edges.retryBottom - edges.retryTop).toBeGreaterThan(0);
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

describe('InFlowBanner', () => {
  test('portals custom chrome into the in-flow host', () => {
    renderUi(() => (
      <DismissibleBannerPortalProvider>
        <p data-testid="body">{'body'}</p>
        <InFlowBanner>
          <div data-testid="custom-banner">{'perf'}</div>
        </InFlowBanner>
      </DismissibleBannerPortalProvider>
    ));
    const banner = screen.getByTestId('custom-banner');
    const host = banner.closest(
      '[data-component="DismissibleBannerPortalHost"]'
    );
    if (host === null) throw new Error('banner not in portal host');
    expect(host.getAttribute('data-position')).toBe('top');
    expect(host.compareDocumentPosition(screen.getByTestId('body'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});

describe('DismissibleBanner', () => {
  test('renders into the in-flow portal host, dismisses, and fires the action', () => {
    const onDismiss = mock();
    const onAction = mock();
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
    // Full-bleed sheet; content row is max-width constrained on wide layouts.
    expect(banner.innerHTML).toMatch(/bg-surface[\s"]/);
    expect(banner.innerHTML).toMatch(/max-w-ui-wide/);
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
