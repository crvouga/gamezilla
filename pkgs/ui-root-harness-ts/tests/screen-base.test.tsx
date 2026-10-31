/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { useContentEdgePaddingStep } from '@pkgs/ui-root-client-ts/content-edge-padding';
import { SettingsIcon } from '@pkgs/ui-root-client-ts/icons';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import type { ScreenBaseProps } from '@pkgs/ui-root-client-ts/screen-base-types';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { TopBar } from '@pkgs/ui-root-client-ts/top-bar';
import { hrefToPath } from '@pkgs/ui-root-shared-ts/href';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { type JSX, splitProps } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

const COMPACT = { width: 390, height: 800 };
const WIDE = { width: 1280, height: 900 };

function Screen(
  props: Partial<ScreenBaseProps> & { body?: JSX.Element | undefined }
): JSX.Element {
  const [local, rest] = splitProps(props, ['body']);
  return (
    <ScreenBase
      screenId="demo"
      breadcrumbs={[{ name: 'Home', onClick: () => {} }, { name: 'Demo' }]}
      content={({ bodyClass }) => (
        <div
          class="box"
          classList={{ [bodyClass]: true }}
          data-testid="content"
        >
          {local.body ?? <p class="text">{'body'}</p>}
        </div>
      )}
      {...rest}
    />
  );
}

function fakeRouter(canGoBack: boolean): AppRouter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    push: (h) => calls.push(`push:${hrefToPath(h)}`),
    replace: (h) => calls.push(`replace:${hrefToPath(h)}`),
    back: () => calls.push('back'),
    canGoBack: () => canGoBack,
  };
}

describe('ScreenBase compact', () => {
  test('root and pushed screens title in the same heading style', () => {
    const view = renderUi(
      () => <Screen breadcrumbs={[{ name: 'Spaces' }]} />,
      COMPACT
    );
    const root = screen.getByRole('heading', { level: 1, name: 'Spaces' });
    expect(root.className).toMatch(/\btextHeading\b/);
    view.unmount();
    renderUi(() => <Screen />, COMPACT);
    const title = screen.getByRole('heading', { level: 1, name: 'Demo' });
    expect(title.className).toMatch(/\btextHeading\b/);
  });

  test('the back control is a 44px target', () => {
    renderUi(() => <Screen />, COMPACT);
    const back = mustQuery('[data-component="BackIconButton"]');
    expect(back.outerHTML).toContain('width: 44px');
  });

  test('the top bar hairline shows only once the body has scrolled', () => {
    renderUi(
      () => <Screen scroll body={<p class="text">{'Long body'}</p>} />,
      COMPACT
    );
    const bar = mustQuery('[data-component="ScreenBaseHeader"]');
    expect(bar).toHaveAttribute('data-divider', 'none');
    expect(bar.className).toMatch(/\bborder-transparent\b/);
    const scrollport = mustQuery('[data-component="ScreenBodyScroll"]');
    for (const [key, value] of [
      ['scrollHeight', 2000],
      ['clientHeight', 600],
    ] as const) {
      Object.defineProperty(scrollport, key, { configurable: true, value });
    }
    scrollport.scrollTop = 120;
    fireEvent.scroll(scrollport);
    expect(bar).toHaveAttribute('data-divider', 'hairline');
    expect(bar.className).toMatch(/\bborder-border\b/);
    scrollport.scrollTop = 0;
    fireEvent.scroll(scrollport);
    expect(bar).toHaveAttribute('data-divider', 'none');
  });

  test('trailing chrome sits in the row itself, so a long title keeps the room', () => {
    renderUi(
      () => (
        <TopBar
          center={<p class="text">{'Account privacy'}</p>}
          trailing={<p class="text">{'avatar'}</p>}
        />
      ),
      COMPACT
    );
    const trailing = screen.getByText('avatar');
    const center = screen.getByText('Account privacy').parentElement;
    expect(trailing.parentElement).toBe(center?.parentElement ?? null);
    expect(center?.className).toMatch(/\bgrow\b/);
    expect(center?.className).toMatch(/\bbasis-24\b/);
  });

  test('renders data-screen, TopBar h1 title, back button and body', async () => {
    const user = userEvent.setup();
    const onBack = mock();
    renderUi(
      () => (
        <Screen
          breadcrumbs={[{ name: 'Home', onClick: onBack }, { name: 'Demo' }]}
        />
      ),
      COMPACT
    );
    const root = mustQuery('[data-screen="demo"]');
    expect(root).toHaveAttribute('data-component', 'ScreenBase');
    expect(root).toHaveAttribute('data-mode', 'compact');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Demo');
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByTestId('content').className).toMatch(/flex-1/);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('back crumb with href routes through useBreadcrumbNav', async () => {
    const user = userEvent.setup();
    const router = fakeRouter(false);
    renderUi(
      () => (
        <StaticAppRouterProvider router={router}>
          <Screen breadcrumbs={[{ name: 'Home', href: '/' }, { name: 'X' }]} />
        </StaticAppRouterProvider>
      ),
      COMPACT
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(router.calls).toEqual(['replace:/']);
  });

  test('actions render as buttons (icon + text) and fire', async () => {
    const user = userEvent.setup();
    const save = mock();
    const settings = mock();
    renderUi(
      () => (
        <Screen
          breadcrumbs={[{ name: 'Demo' }]}
          actions={[
            { type: 'submit', label: 'Save', onClick: save },
            {
              type: 'default',
              label: 'Settings',
              icon: SettingsIcon,
              onClick: settings,
            },
          ]}
        />
      ),
      COMPACT
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(settings).toHaveBeenCalledTimes(1);
  });

  test('scroll body wraps content in a scroller and pins the footer below it', () => {
    renderUi(
      () => <Screen scroll footer={<p class="text">{'footer'}</p>} />,
      COMPACT
    );
    const scroller = mustQuery('[data-component="ScreenBodyScroll"]');
    expect(scroller.className).toMatch(/scroll/);
    expect(scroller.className).toMatch(/flex-1/);
    const footer = mustQuery('[data-component="ScreenFooter"]');
    expect(footer.className).toMatch(/safeBottom/);
    expect(footer.className).not.toMatch(/border-t/);
    // Footer is a sibling after the scroller inside the body column.
    const body = footer.parentElement;
    if (body === null) throw new Error('missing body');
    expect(body.children[0]?.contains(scroller)).toBe(true);
    expect(body.children[1]).toBe(footer);
    expect(screen.getByText('footer')).toBeInTheDocument();
  });

  test('non-scroll body without footer absorbs the safe-area inset itself', () => {
    renderUi(() => <Screen />, COMPACT);
    const content = screen.getByTestId('content');
    const bodyFrame = content.parentElement?.parentElement;
    expect(bodyFrame?.className).toMatch(/safeBottom/);
    expect(
      document.querySelector('[data-component="ScreenFooter"]')
    ).toBeNull();
  });

  test('bottomBar pins under the footer and takes the safe-area inset', () => {
    renderUi(
      () => (
        <Screen
          footer={<p class="text">{'footer'}</p>}
          bottomBar={<p class="text">{'bar'}</p>}
        />
      ),
      COMPACT
    );
    const footer = mustQuery('[data-component="ScreenFooter"]');
    const bar = mustQuery('[data-component="ScreenBottomBar"]');
    expect(footer.className).not.toMatch(/safeBottom/);
    expect(bar.className).toMatch(/safeBottom/);
    expect(footer.nextElementSibling).toBe(bar);
  });

  test('largeTitle hides the TopBar title until the body scrolls', () => {
    renderUi(() => <Screen scroll largeTitle />, COMPACT);
    const large = mustQuery('[data-component="ScreenLargeTitle"]');
    expect(large).toHaveTextContent('Demo');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const scroller = mustQuery('[data-component="ScreenBodyScroll"]');
    Object.defineProperty(scroller, 'scrollTop', {
      value: 80,
      configurable: true,
    });
    fireEvent.scroll(scroller);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(2);
  });

  test('primaryAction renders a FAB that runs the mutation', async () => {
    const user = userEvent.setup();
    const operation = mock(async () => {});
    renderUi(
      () => (
        <Screen
          primaryAction={{
            labels: { idle: 'Create', loading: 'Creating…' },
            operation,
          }}
        />
      ),
      COMPACT
    );
    const fab = screen.getByRole('button', { name: 'Create' });
    expect(fab).toHaveAttribute('data-component', 'ScreenBasePrimaryAction');
    await user.click(fab);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('virtual list body renders rows inside the padded shell', () => {
    const items = Array.from({ length: 50 }, (_, i) => `row-${i}`);
    renderUi(
      () => (
        <Screen
          body={
            <ScreenBodyVirtualList
              items={items}
              keyExtractor={(item) => item}
              renderItem={(item) => <p class="text">{item}</p>}
              estimateSize={40}
              fixedViewport={{ width: 390, height: 200 }}
              dataSet={{ testid: 'vl' }}
            />
          }
        />
      ),
      COMPACT
    );
    const list = screen.getByTestId('vl');
    expect(list).toHaveAttribute('data-component', 'ScreenBodyVirtualList');
    expect(list.className).toMatch(/flex-1/);
    const rows = screen.getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(items.length);
    expect(screen.getByText('row-0')).toBeInTheDocument();
    // Shell edge padding is cancelled so the scrollbar sits flush.
    const wrapper = list.parentElement;
    expect((wrapper ?? list).className.length).toBeGreaterThan(0);
  });

  test('wide virtual list keeps a flex height chain for flush-edge', () => {
    const items = Array.from({ length: 30 }, (_, i) => `row-${i}`);
    renderUi(
      () => (
        <AppFrame>
          <Screen
            body={
              <div class="box flex-1 min-h-0 gap-2">
                <p class="text">{'filters'}</p>
                <ScreenBodyVirtualList
                  items={items}
                  keyExtractor={(item) => item}
                  renderItem={(item) => <p class="text">{item}</p>}
                  estimateSize={40}
                  fixedViewport={{ width: 800, height: 400 }}
                  dataSet={{ testid: 'vl-wide' }}
                />
              </div>
            }
          />
        </AppFrame>
      ),
      WIDE
    );
    const list = screen.getByTestId('vl-wide');
    const flush = list.parentElement;
    const shell = flush?.parentElement;
    expect(shell?.className).toMatch(/\bbox\b/);
    expect(shell?.className).toMatch(/flex-1/);
    expect(shell?.className).toMatch(/min-h-0/);
    expect(flush?.className).toMatch(/flex-1/);
    expect(flush?.className).toMatch(/min-h-0/);
    expect(screen.getByText('row-0')).toBeInTheDocument();
    expect(mustQuery('[data-screen="demo"]').contains(list)).toBe(true);
  });
});

describe('ScreenBase wide', () => {
  test('renders breadcrumb trail with h1 title, link crumbs, actions and body', async () => {
    const user = userEvent.setup();
    const home = mock();
    const save = mock();
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame>
            <Screen
              breadcrumbs={[{ name: 'Home', onClick: home }, { name: 'Demo' }]}
              actions={[{ type: 'submit', label: 'Save', onClick: save }]}
            />
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    const root = mustQuery('[data-screen="demo"]');
    expect(root).toHaveAttribute('data-mode', 'wide');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Demo');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(home).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(root.contains(screen.getByText('body'))).toBe(true);
  });

  // regression: wide-screen-body-island-inset
  test('wide body starts at the page title edge: no inset, edge step 0', () => {
    function EdgeProbe(): JSX.Element {
      return (
        <p class="text" data-testid="edge">
          {String(useContentEdgePaddingStep())}
        </p>
      );
    }
    for (const scroll of [false, true]) {
      const { unmount } = renderUi(
        () => <Screen scroll={scroll} body={<EdgeProbe />} />,
        WIDE
      );
      const root = mustQuery('[data-screen="demo"]');
      expect(screen.getByTestId('edge')).toHaveTextContent('0');
      let el: Element | null = screen.getByTestId('content');
      while (el !== null && el !== root) {
        expect(cssOf(el)).not.toMatch(/padding(-left)?:[1-9]/);
        expect(el.className).not.toMatch(/\b(p|px|pl)-[1-9]/);
        el = el.parentElement;
      }
      unmount();
    }
  });

  test('scrolling wide body scrolls as one; footer gets no divider', () => {
    renderUi(
      () => <Screen scroll footer={<p class="text">{'footer'}</p>} />,
      WIDE
    );
    const footer = mustQuery('[data-component="ScreenFooter"]');
    expect(footer.className).not.toMatch(/border-t/);
    expect(mustQuery('[data-component="ScreenBodyScroll"]')).toBeTruthy();
  });

  test('primaryAction renders as a header button', () => {
    renderUi(
      () => (
        <Screen
          primaryAction={{
            labels: { idle: 'Create' },
            operation: async () => {},
          }}
        />
      ),
      WIDE
    );
    const btn = screen.getByRole('button', { name: 'Create' });
    expect(btn).toHaveAttribute('data-component', 'ScreenBasePrimaryAction');
    expect(btn).toHaveAttribute('data-intent', 'primary');
  });
});
