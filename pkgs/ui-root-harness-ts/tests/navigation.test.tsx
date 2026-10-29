/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import {
  AppRouterProvider,
  StaticAppRouterProvider,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from '@pkgs/ui-root-client-ts/app-router';
import { BrandIcon } from '@pkgs/ui-root-client-ts/brand-icon';
import { ComposeProviders } from '@pkgs/ui-root-client-ts/compose-providers';
import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';
import { hrefToPath } from '@pkgs/ui-root-shared-ts/href';
import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import {
  createContext,
  type JSX,
  type ParentProps,
  useContext,
} from 'solid-js';
import { renderUi } from './render';

describe('hrefToPath', () => {
  test('fills [tokens] and appends leftovers as a query string', () => {
    expect(hrefToPath('/x')).toBe('/x');
    expect(
      hrefToPath({
        pathname: '/space/[id]',
        params: { id: 'a b', tab: 'chat' },
      })
    ).toBe('/space/a%20b?tab=chat');
  });
});

describe('AppRouterProvider over @solidjs/router', () => {
  function Screen(): JSX.Element {
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams();
    return (
      <>
        <p class="text">{`path:${pathname()}`}</p>
        <p class="text">{`id:${params()['id'] ?? '-'} q:${params()['q'] ?? '-'}`}</p>
        <p class="text">{`back:${router.canGoBack() ? 'yes' : 'no'}`}</p>
        <button
          class="clickable clickableTint"
          type="button"
          onClick={() =>
            router.push({
              pathname: '/space/[id]',
              params: { id: '7', q: 'z' },
            })
          }
        >
          go
        </button>
        <button
          class="clickable clickableTint"
          type="button"
          onClick={() => router.back()}
        >
          back
        </button>
      </>
    );
  }

  test('push / back / params / pathname', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    renderUi(() => (
      <MemoryRouter
        history={history}
        root={(p) => <AppRouterProvider>{p.children}</AppRouterProvider>}
      >
        <Route path="/" component={Screen} />
        <Route path="/space/:id" component={Screen} />
      </MemoryRouter>
    ));
    expect(screen.getByText('path:/')).toBeInTheDocument();
    expect(screen.getByText('back:no')).toBeInTheDocument();
    await user.click(screen.getByText('go'));
    expect(await screen.findByText('path:/space/7')).toBeInTheDocument();
    expect(screen.getByText('id:7 q:z')).toBeInTheDocument();
    expect(screen.getByText('back:yes')).toBeInTheDocument();
    // regression: duplicate-route-push-escapes-app
    await user.click(screen.getByText('go'));
    await user.click(screen.getByText('back'));
    expect(await screen.findByText('path:/')).toBeInTheDocument();
    expect(screen.getByText('back:no')).toBeInTheDocument();
  });
});

describe('useBreadcrumbNav', () => {
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

  function Crumb(): JSX.Element {
    const nav = useBreadcrumbNav();
    return (
      <button
        class="clickable clickableTint"
        type="button"
        onClick={nav('/home')}
      >
        crumb
      </button>
    );
  }

  test('pops when possible, otherwise replaces to the fallback', async () => {
    const user = userEvent.setup();
    const canPop = fakeRouter(true);
    const cannot = fakeRouter(false);
    renderUi(() => (
      <>
        <StaticAppRouterProvider router={canPop}>
          <Crumb />
        </StaticAppRouterProvider>
        <StaticAppRouterProvider router={cannot}>
          <Crumb />
        </StaticAppRouterProvider>
      </>
    ));
    const [first, second] = screen.getAllByText('crumb');
    if (first === undefined || second === undefined) throw new Error('crumbs');
    await user.click(first);
    await user.click(second);
    expect(canPop.calls).toEqual(['back']);
    expect(cannot.calls).toEqual(['replace:/home']);
  });
});

describe('brand + providers', () => {
  test('AppLogo renders the wordmark as a heading, never in the accent', () => {
    renderUi(() => <AppLogo name="acme" size={40} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('acme');
    expect(h1.className).toContain('appLogo');
    expect(h1.className).not.toContain('text-tint');
  });

  test('BrandIcon renders fixed-color vendor svg', () => {
    renderUi(() => (
      <BrandIcon name="google" size={32} dataSet={{ testid: 'g' }} />
    ));
    const svg = screen.getByTestId('g').querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.querySelector('path')?.getAttribute('fill')).toBe('#FFC107');
  });

  test('ComposeProviders nests outermost-first', () => {
    const Ctx = createContext<string[]>([]);
    const tag = (name: string) => (p: ParentProps) => {
      const outer = useContext(Ctx);
      return <Ctx.Provider value={[...outer, name]}>{p.children}</Ctx.Provider>;
    };
    function Leaf(): JSX.Element {
      return <p class="text">{useContext(Ctx).join('>')}</p>;
    }
    renderUi(() => (
      <ComposeProviders providers={[tag('a'), tag('b'), tag('c')]}>
        <Leaf />
      </ComposeProviders>
    ));
    expect(screen.getByText('a>b>c')).toBeInTheDocument();
  });
});
