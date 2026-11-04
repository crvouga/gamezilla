/** @jsxImportSource solid-js */

import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';

import type { ScreenBaseBreadcrumb } from '../screen-base-types';

export type AppFrameHeaderOverride = JSX.Element | false | null;

type ScreenNavigation = {
  readonly titleId: string;
  readonly breadcrumbs: Accessor<readonly ScreenBaseBreadcrumb[]>;
};

type AppFrameChromeContextValue = {
  readonly screenNavigation: () => boolean;
  readonly screens: Accessor<readonly ScreenNavigation[]>;
  readonly setScreens: (
    update: (
      screens: readonly ScreenNavigation[]
    ) => readonly ScreenNavigation[]
  ) => void;
  readonly headerOverride: Accessor<AppFrameHeaderOverride>;
  readonly setHeaderOverride: (node: AppFrameHeaderOverride) => void;
  readonly globalTrailing: Accessor<JSX.Element | null>;
};

const AppFrameChromeContext = createContext<AppFrameChromeContextValue>();

export type AppFrameChromeProviderProps = {
  /** Wide screens publish their existing breadcrumb contracts to the header island. */
  readonly screenNavigation?: boolean | undefined;
  /** Always-visible trailing chrome (e.g. avatar global menu). */
  readonly globalTrailing?: JSX.Element | undefined;
  readonly children: JSX.Element;
};

/**
 * App-frame chrome registry: screens can override (or hide) the wide header
 * island for their lifetime; the shell reads the resolved header.
 */
export function AppFrameChromeProvider(
  props: AppFrameChromeProviderProps
): JSX.Element {
  const [headerOverride, setHeaderOverride] =
    createSignal<AppFrameHeaderOverride>(null);
  const [screens, setScreens] = createSignal<readonly ScreenNavigation[]>([]);
  const value: AppFrameChromeContextValue = {
    screenNavigation: () => props.screenNavigation === true,
    screens,
    setScreens,
    headerOverride,
    setHeaderOverride: (node) => setHeaderOverride(() => node),
    globalTrailing: () => props.globalTrailing ?? null,
  };
  return (
    <AppFrameChromeContext.Provider value={value}>
      {props.children}
    </AppFrameChromeContext.Provider>
  );
}

/**
 * Register a header override for the lifetime of the calling component.
 * `false` hides the header; `null` restores the default.
 */
export function useSetAppFrameHeader(node: AppFrameHeaderOverride): void {
  const ctx = useContext(AppFrameChromeContext);
  if (ctx === undefined) return;
  ctx.setHeaderOverride(node);
  onCleanup(() => ctx.setHeaderOverride(null));
}

/** True inside a column whose sidebar already carries the global chrome. */
const GlobalTrailingInRailContext = createContext<Accessor<boolean>>(
  () => false
);

/**
 * Marks content beside a sidebar that shows the global chrome (the account
 * menu), so headers inside it do not draw it a second time.
 */
export function GlobalTrailingInRail(props: {
  readonly when: boolean;
  readonly children: JSX.Element;
}): JSX.Element {
  // Inherits: content already marked beside a sidebar stays marked.
  const outer = useContext(GlobalTrailingInRailContext);
  const when = createMemo(() => props.when || outer());
  return (
    <GlobalTrailingInRailContext.Provider value={when}>
      {props.children}
    </GlobalTrailingInRailContext.Provider>
  );
}

export function useAppFrameGlobalTrailing(): Accessor<JSX.Element | null> {
  const ctx = useContext(AppFrameChromeContext);
  const inRail = useContext(GlobalTrailingInRailContext);
  return () => (inRail() ? null : (ctx?.globalTrailing() ?? null));
}

/** Resolved header: an override when registered, else `defaultHeader`. */
export function useAppFrameHeader(
  defaultHeader: () => JSX.Element
): Accessor<JSX.Element> {
  const ctx = useContext(AppFrameChromeContext);
  return () => {
    const override = ctx?.headerOverride() ?? null;
    if (override === false) return null;
    if (override !== null) return override;
    return defaultHeader();
  };
}

/**
 * Whether a screen has replaced or hidden the default header for its
 * lifetime (an active space draws its own chrome; the sidebar steps aside).
 */
export function useAppFrameHeaderOverridden(): Accessor<boolean> {
  const ctx = useContext(AppFrameChromeContext);
  return () => (ctx?.headerOverride() ?? null) !== null;
}

/** Register the mounted wide screen, with identity-safe cleanup during route swaps. */
export function usePublishScreenNavigation(
  breadcrumbs: Accessor<readonly ScreenBaseBreadcrumb[]>,
  titleId: string
): Accessor<boolean> {
  const ctx = useContext(AppFrameChromeContext);
  if (ctx === undefined) return () => false;
  const entry = { breadcrumbs, titleId };
  const unregister = () =>
    ctx.setScreens((screens) => screens.filter((screen) => screen !== entry));
  createEffect(() => {
    if (!ctx.screenNavigation()) return;
    ctx.setScreens((screens) => [...screens, entry]);
    onCleanup(unregister);
  });
  return () => ctx.screenNavigation() && ctx.headerOverride() === null;
}

/** The current screen's live contract; empty when the shell has no registered screen. */
export function useAppFrameBreadcrumbs(): Accessor<
  readonly ScreenBaseBreadcrumb[]
> {
  const ctx = useContext(AppFrameChromeContext);
  return () => ctx?.screens().at(-1)?.breadcrumbs() ?? [];
}

/** ID of the single page heading rendered by the header island on subscreens. */
export function useAppFrameScreenTitleId(): Accessor<string | undefined> {
  const ctx = useContext(AppFrameChromeContext);
  return () => ctx?.screens().at(-1)?.titleId;
}
