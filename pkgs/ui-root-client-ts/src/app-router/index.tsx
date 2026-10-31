/** @jsxImportSource solid-js */

import type { Href, HrefObject } from '@pkgs/ui-root-shared-ts/href';
import { hrefToPath, normalizePath } from '@pkgs/ui-root-shared-ts/href';
import {
  useBeforeLeave,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from '@solidjs/router';
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  untrack,
  useContext,
} from 'solid-js';
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

const AppRouterContext = createContext<AppRouter>();

export type AppRouterProviderProps = {
  readonly children: JSX.Element;
};

/** Mount once inside `<Router>`; provides the facade to the subtree. */
function RoutedAppRouter(props: AppRouterProviderProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = usePendingNavigation();
  const confirmNavigation = useConfirmNavigation();
  useBeforeLeave((event) => {
    if (event.defaultPrevented || !navigation?.blocked()) return;
    event.preventDefault();
    navigation.request(() => event.retry(true));
  });
  const [depth, setDepth] = createSignal(0);
  const router: AppRouter = {
    push(href) {
      const path = normalizePath(hrefToPath(href));
      if (path === `${location.pathname}${location.search}${location.hash}`)
        return;
      confirmNavigation(() => {
        navigate(path);
        setDepth((d) => d + 1);
      });
    },
    replace(href) {
      confirmNavigation(() =>
        navigate(normalizePath(hrefToPath(href)), { replace: true })
      );
    },
    back() {
      if (depth() === 0) return;
      confirmNavigation(() => {
        setDepth((d) => d - 1);
        navigate(-1);
      });
    },
    canGoBack: () => depth() > 0,
  };
  return (
    <AppRouterContext.Provider value={router}>
      {props.children}
    </AppRouterContext.Provider>
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
    <AppRouterContext.Provider value={guarded}>
      {props.children}
    </AppRouterContext.Provider>
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
  return useContext(AppRouterContext);
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
