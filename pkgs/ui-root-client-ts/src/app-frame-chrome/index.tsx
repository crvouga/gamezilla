/** @jsxImportSource @solidjs/web */

import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
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
  /** Registers an override; the returned function withdraws that one only. */
  readonly overrideHeader: (node: AppFrameHeaderOverride) => () => void;
  readonly globalTrailing: Accessor<JSX.Element | null>;
  readonly globalStatus: Accessor<JSX.Element | null>;
};

const AppFrameChromeContext = createContext<AppFrameChromeContextValue | null>(
  null
);

export type AppFrameChromeProviderProps = {
  /** Wide screens publish their existing breadcrumb contracts to the header island. */
  readonly screenNavigation?: boolean | undefined;
  /** Always-visible trailing chrome (e.g. avatar global menu). */
  readonly globalTrailing?: JSX.Element | undefined;
  /**
   * The status part of the trailing chrome alone (working offline, the
   * connection missing), for a bar that leaves the account menu out.
   */
  readonly globalStatus?: JSX.Element | undefined;
  readonly children: JSX.Element;
};

/**
 * App-frame chrome registry: screens can override (or hide) the wide header
 * island for their lifetime; the shell reads the resolved header.
 */
export function AppFrameChromeProvider(
  props: AppFrameChromeProviderProps
): JSX.Element {
  // Held in an entry so a leaving screen withdraws its own override and
  // never the one the arriving screen has just registered.
  const [override, setOverride] = createSignal<{
    readonly node: AppFrameHeaderOverride;
  } | null>(null);
  const [screens, setScreens] = createSignal<readonly ScreenNavigation[]>([]);
  const value: AppFrameChromeContextValue = {
    screenNavigation: () => props.screenNavigation === true,
    screens,
    setScreens,
    headerOverride: () => override()?.node ?? null,
    overrideHeader: (node) => {
      const entry = { node };
      setOverride(entry);
      return () => {
        setOverride((current) => (current === entry ? null : current));
      };
    },
    globalTrailing: () => props.globalTrailing ?? null,
    globalStatus: () => props.globalStatus ?? null,
  };
  return (
    <AppFrameChromeContext value={value}>
      {props.children}
    </AppFrameChromeContext>
  );
}

/**
 * Register a header override for the lifetime of the calling component.
 * `false` hides the header; `null` restores the default.
 */
export function useSetAppFrameHeader(node: AppFrameHeaderOverride): void {
  const ctx = useContext(AppFrameChromeContext);
  if (ctx === null) return;
  onSettled(() => ctx.overrideHeader(node));
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
    <GlobalTrailingInRailContext value={when}>
      {props.children}
    </GlobalTrailingInRailContext>
  );
}

export function useAppFrameGlobalTrailing(): Accessor<JSX.Element | null> {
  const ctx = useContext(AppFrameChromeContext);
  const inRail = useContext(GlobalTrailingInRailContext);
  return () => (inRail() ? null : (ctx?.globalTrailing() ?? null));
}

/**
 * The app's status without its account menu, for a bar that is not the
 * app's own (a space's top bar). Nothing beside a sidebar, which shows it.
 */
export function useAppFrameGlobalStatus(): Accessor<JSX.Element | null> {
  const ctx = useContext(AppFrameChromeContext);
  const inRail = useContext(GlobalTrailingInRailContext);
  return () => (inRail() ? null : (ctx?.globalStatus() ?? null));
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
  if (ctx === null) return () => false;
  const entry = { breadcrumbs, titleId };
  const unregister = () =>
    ctx.setScreens((screens) => screens.filter((screen) => screen !== entry));
  createEffect(createMemo(ctx.screenNavigation), (publishes) => {
    if (!publishes) return undefined;
    ctx.setScreens((screens) => [...screens, entry]);
    return unregister;
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
