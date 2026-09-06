/**
 * App navigation helpers over React Navigation (replaces expo-router hooks).
 * Path strings match the linking config registered via {@link setAppLinkingConfig}.
 *
 * Production uses the module singleton {@link navigationRef}. Embedded multi-App
 * hosts provide a per-tree ref via {@link NavigationRefProvider}.
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
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

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

/** Production default — attached by the top-level product App. */
export const navigationRef = createNavigationContainerRef();

export type AppNavigationRef = typeof navigationRef;

const NavigationRefContext = createContext<AppNavigationRef>(navigationRef);

export function NavigationRefProvider(props: {
  readonly navigationRef: AppNavigationRef;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <NavigationRefContext.Provider value={props.navigationRef}>
      {props.children}
    </NavigationRefContext.Provider>
  );
}

export function useNavigationRef(): AppNavigationRef {
  return useContext(NavigationRefContext);
}

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

function dispatchAction(ref: AppNavigationRef, action: unknown): void {
  if (!ref.isReady()) return;
  // exactOptionalPropertyTypes fights NavigationAction payload optionality
  ref.dispatch(action as never);
}

function dispatchPath(
  ref: AppNavigationRef,
  path: string,
  mode: 'push' | 'replace'
): void {
  if (!ref.isReady()) return;
  const normalized = normalizePath(path);
  if (normalized === '/') {
    dispatchAction(
      ref,
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
    dispatchAction(ref, CommonActions.reset(state));
    return;
  }
  const action = getActionFromState(state, linkingConfig);
  if (action !== undefined) {
    dispatchAction(ref, action);
  }
}

function pathnameFromRootState(ref: AppNavigationRef): string {
  if (!ref.isReady()) return '/';
  const state = ref.getRootState();
  if (state === undefined) return '/';
  try {
    const path = getPathFromState(state, linkingConfig);
    if (path === undefined || path === '') return '/';
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return '/';
  }
}

/**
 * `createNavigationContainerRef` queues listeners added before the container
 * attaches and replays them once it does, so subscribing while not-yet-ready
 * is safe — and required: the header chrome mounts before the navigator, and
 * a one-shot notify here would leave `usePathname` pinned to `/` forever.
 */
function subscribeRootNavigationState(
  ref: AppNavigationRef,
  onStoreChange: () => void
): () => void {
  const unsubscribe = ref.addListener('state', onStoreChange);
  return () => {
    unsubscribe();
  };
}

function createRouterForRef(ref: AppNavigationRef): AppRouter {
  return {
    push(href) {
      dispatchPath(ref, hrefToPath(href), 'push');
    },
    replace(href) {
      dispatchPath(ref, hrefToPath(href), 'replace');
    },
    back() {
      if (ref.isReady() && ref.canGoBack()) {
        ref.goBack();
      }
    },
    canGoBack() {
      return ref.isReady() && ref.canGoBack();
    },
  };
}

/**
 * Imperative router for non-React call sites (production singleton).
 * Requires {@link navigationRef} attached to NavigationContainer.
 */
export const router: AppRouter = createRouterForRef(navigationRef);

/** Hook mirror of {@link router} — reads the nearest NavigationRefProvider. */
export function useRouter(): AppRouter {
  const ref = useNavigationRef();
  return useMemo(() => createRouterForRef(ref), [ref]);
}

export function usePathname(): string {
  const ref = useNavigationRef();
  return useSyncExternalStore(
    (onStoreChange) => subscribeRootNavigationState(ref, onStoreChange),
    () => pathnameFromRootState(ref),
    () => pathnameFromRootState(ref)
  );
}

export function useLocalSearchParams<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): T {
  const route = useRoute();
  return (route.params ?? {}) as T;
}
