/**
 * App navigation helpers over React Navigation (replaces expo-router hooks).
 * Path strings match the linking config registered via {@link setAppLinkingConfig}.
 */

import {
  CommonActions,
  createNavigationContainerRef,
  getActionFromState,
  getPathFromState,
  getStateFromPath,
  type LinkingOptions,
  type ParamListBase,
  useRoute,
} from '@react-navigation/native';
import { useSyncExternalStore } from 'react';

/** Path string used with linking (e.g. `/space/abc`, `/more/theme`). */
export type Href = string;

export type HrefObject = {
  readonly pathname: string;
  readonly params?: Record<string, string | undefined>;
};

export type AppRouter = {
  push: (href: Href | HrefObject) => void;
  replace: (href: Href | HrefObject) => void;
  back: () => void;
  canGoBack: () => boolean;
};

export const navigationRef = createNavigationContainerRef();

type LinkingConfig = NonNullable<LinkingOptions<ParamListBase>['config']>;

let linkingConfig: LinkingConfig | undefined;

/** Register linking screen config so path → action resolution works. */
export function setAppLinkingConfig(config: LinkingConfig): void {
  linkingConfig = config;
}

function applyParamsToPath(
  pathname: string,
  params: Record<string, string | undefined> | undefined
): string {
  let path = pathname;
  const unused: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    const token = `[${key}]`;
    if (path.includes(token)) {
      path = path.split(token).join(encodeURIComponent(value));
    } else {
      unused[key] = value;
    }
  }
  const qs = Object.entries(unused)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  if (qs.length === 0) return path;
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}

export function hrefToPath(href: Href | HrefObject): string {
  if (typeof href === 'string') return href;
  return applyParamsToPath(href.pathname, href.params);
}

function normalizePath(path: string): string {
  if (path === '' || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function pathForState(path: string): string {
  const n = normalizePath(path);
  return n === '/' ? '' : n.replace(/^\//, '');
}

function dispatchAction(action: unknown): void {
  if (!navigationRef.isReady()) return;
  // exactOptionalPropertyTypes fights NavigationAction payload optionality
  navigationRef.dispatch(action as never);
}

function dispatchPath(path: string, mode: 'push' | 'replace'): void {
  if (!navigationRef.isReady()) return;
  const normalized = normalizePath(path);
  if (normalized === '/') {
    dispatchAction(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      })
    );
    return;
  }
  if (linkingConfig === undefined) return;
  const state = getStateFromPath(pathForState(normalized), linkingConfig);
  if (state === undefined) return;
  if (mode === 'replace') {
    dispatchAction(CommonActions.reset(state));
    return;
  }
  const action = getActionFromState(state, linkingConfig);
  if (action !== undefined) {
    dispatchAction(action);
  }
}

function pathnameFromRootState(): string {
  if (!navigationRef.isReady()) return '/';
  const state = navigationRef.getRootState();
  if (state === undefined) return '/';
  try {
    const path = getPathFromState(state, linkingConfig);
    if (path === undefined || path === '') return '/';
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return '/';
  }
}

function subscribeRootNavigationState(onStoreChange: () => void): () => void {
  if (!navigationRef.isReady()) {
    onStoreChange();
    return () => undefined;
  }
  return navigationRef.addListener('state', onStoreChange);
}

/**
 * Imperative router for non-React call sites (inbox deep links).
 * Requires {@link navigationRef} attached to NavigationContainer.
 */
export const router: AppRouter = {
  push(href) {
    dispatchPath(hrefToPath(href), 'push');
  },
  replace(href) {
    dispatchPath(hrefToPath(href), 'replace');
  },
  back() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  },
  canGoBack() {
    return navigationRef.isReady() && navigationRef.canGoBack();
  },
};

/** Hook mirror of {@link router} — works under NavigationContainer, not only inside a screen. */
export function useRouter(): AppRouter {
  return router;
}

export function usePathname(): string {
  return useSyncExternalStore(
    subscribeRootNavigationState,
    pathnameFromRootState,
    pathnameFromRootState
  );
}

export function useLocalSearchParams<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): T {
  const route = useRoute();
  return (route.params ?? {}) as T;
}
