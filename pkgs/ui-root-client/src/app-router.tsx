/** @jsxImportSource solid-js */
/**
 * Routing seam for the design system and feature libs: a small `AppRouter`
 * facade over `@solidjs/router` so screens never import the router directly.
 *
 * `canGoBack` is tracked by this facade (SPA history depth since the app
 * mounted) so "back" only pops entries this app pushed; otherwise callers
 * `replace` to a fallback (see `useBreadcrumbNav`).
 */

import type { Href, HrefObject } from '@pkgs/ui-root-shared/href';
import { hrefToPath, normalizePath } from '@pkgs/ui-root-shared/href';
import {
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
export function AppRouterProvider(props: AppRouterProviderProps): JSX.Element {
  const navigate = useNavigate();
  const [depth, setDepth] = createSignal(0);
  const router: AppRouter = {
    push(href) {
      navigate(normalizePath(hrefToPath(href)));
      setDepth((d) => d + 1);
    },
    replace(href) {
      navigate(normalizePath(hrefToPath(href)), { replace: true });
    },
    back() {
      if (depth() === 0) return;
      setDepth((d) => d - 1);
      navigate(-1);
    },
    canGoBack: () => depth() > 0,
  };
  return (
    <AppRouterContext.Provider value={router}>
      {props.children}
    </AppRouterContext.Provider>
  );
}

/** Explicit router (tests / hosts without `@solidjs/router`). */
export function StaticAppRouterProvider(props: {
  readonly router: AppRouter;
  readonly children: JSX.Element;
}): JSX.Element {
  const router = untrack(() => props.router);
  return (
    <AppRouterContext.Provider value={router}>
      {props.children}
    </AppRouterContext.Provider>
  );
}

export function useRouter(): AppRouter {
  const router = useContext(AppRouterContext);
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
