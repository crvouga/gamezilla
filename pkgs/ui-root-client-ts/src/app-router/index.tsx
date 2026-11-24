/** @jsxImportSource @solidjs/web */

import type { Href, HrefObject } from '@pkgs/ui-root-shared-ts/href';
import { hrefToPath, normalizePath } from '@pkgs/ui-root-shared-ts/href';
import {
  useBeforeLeave,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { type Accessor, createContext, createSignal, untrack, useContext } from 'solid-js';
import {
  useConfirmNavigation,
  usePendingNavigation,
} from '../pending-navigation';
import { PendingNavigationProvider } from '../pending-navigation-provider/index';

export type AppRouter = {
  push: (href: Href | HrefObject) => void;
  replace: (href: Href | HrefObject) => void;
  back: () => void;
  canGoBack: () => boolean;
};

/** `null` outside a provider: reusable chrome also renders without a router. */
const AppRouterContext = createContext<AppRouter | null>(null);

export type AppRouterProviderProps = {
  readonly children: JSX.Element;
};

/** Mount once inside the router's root layout; provides the facade to the subtree. */
function RoutedAppRouter(props: AppRouterProviderProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = usePendingNavigation();
  const confirmNavigation = useConfirmNavigation();
  // The facade asks before it navigates, so the leave guard lets its own
  // navigations through instead of asking a second time.
  let confirmed = false;
  const go = (to: string | number, options?: { replace: boolean }): void => {
    confirmed = true;
    try {
      navigate(to, options);
    } finally {
      confirmed = false;
    }
  };
  useBeforeLeave((event) => {
    if (confirmed || event.defaultPrevented || !navigation?.blocked()) return;
    event.preventDefault();
    navigation.request(() => event.retry(true));
  });
  // The count lives outside the signal so consecutive calls in one handler
  // see each other; the signal only publishes `canGoBack` to the view.
  let depth = 0;
  const [canGoBack, setCanGoBack] = createSignal(false);
  const moveDepth = (delta: number): void => {
    depth += delta;
    setCanGoBack(depth > 0);
  };
  const router: AppRouter = {
    push(href) {
      const path = normalizePath(hrefToPath(href));
      if (path === `${location.pathname}${location.search}${location.hash}`)
        return;
      confirmNavigation(() => {
        go(path);
        moveDepth(1);
      });
    },
    replace(href) {
      confirmNavigation(() =>
        go(normalizePath(hrefToPath(href)), { replace: true })
      );
    },
    back() {
      if (depth === 0) return;
      confirmNavigation(() => {
        moveDepth(-1);
        go(-1);
      });
    },
    canGoBack,
  };
  return (
    <AppRouterContext value={router}>
      {props.children}
    </AppRouterContext>
  );
}

/**
 * Routing seam for the design system and sub libs: a small `AppRouter`
 * facade over `@solidjs/router` so screens never import the router directly.
 *
 * `canGoBack` is tracked by this facade (SPA history depth since the app
 * mounted) so "back" only pops entries this app pushed; otherwise callers
 * `replace` to a fallback (see `useBreadcrumbNav`).
 */
export function AppRouterProvider(props: AppRouterProviderProps): JSX.Element {
  return (
    <PendingNavigationProvider>
      <RoutedAppRouter>{props.children}</RoutedAppRouter>
    </PendingNavigationProvider>
  );
}

/** Explicit router (tests / hosts without `@solidjs/router`). */
type StaticRouterProps = {
  readonly router: AppRouter;
  readonly children: JSX.Element;
};

function StaticRouterContext(props: StaticRouterProps): JSX.Element {
  const router = untrack(() => props.router);
  const confirmNavigation = useConfirmNavigation();
  const guarded: AppRouter = {
    push: (href) => confirmNavigation(() => router.push(href)),
    replace: (href) => confirmNavigation(() => router.replace(href)),
    back: () => confirmNavigation(router.back),
    canGoBack: router.canGoBack,
  };
  return (
    <AppRouterContext value={guarded}>
      {props.children}
    </AppRouterContext>
  );
}

export function StaticAppRouterProvider(props: StaticRouterProps): JSX.Element {
  return (
    <PendingNavigationProvider>
      <StaticRouterContext router={props.router}>
        {props.children}
      </StaticRouterContext>
    </PendingNavigationProvider>
  );
}

/** Optional routing seam for reusable chrome also rendered without a router. */
export function useOptionalRouter(): AppRouter | undefined {
  return useContext(AppRouterContext) ?? undefined;
}

export function useRouter(): AppRouter {
  const router = useOptionalRouter();
  if (router === undefined) {
    throw new Error('useRouter: AppRouterProvider missing');
  }
  return router;
}

/** Reactive current pathname (`/` at the root). */
export function usePathname(): Accessor<string> {
  const location = useLocation();
  return () => normalizePath(location.pathname);
}

/** Reactive route + query params merged (route params win). */
export function useLocalSearchParams<
  T extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>(): Accessor<T> {
  const params = useParams();
  const [search] = useSearchParams();
  return () => {
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(search)) {
      out[key] = Array.isArray(value) ? value[0] : value;
    }
    for (const [key, value] of Object.entries(params)) out[key] = value;
    return out as T;
  };
}
