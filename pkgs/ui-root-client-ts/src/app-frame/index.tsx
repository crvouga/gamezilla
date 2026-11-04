/** @jsxImportSource solid-js */

import { type JSX, Show } from 'solid-js';
import {
  GlobalTrailingInRail,
  useAppFrameHeader,
  useAppFrameHeaderOverridden,
} from '../app-frame-chrome/index';
import { ContentEdgePaddingProvider } from '../content-edge-padding/index';
import { DismissibleBannerPortalProvider } from '../dismissible-top-banner/index';
import { ScreenFocusProvider } from '../screen-focus/index';
import { useLayoutMode } from '../use-layout-mode';

export type AppFrameProps = {
  /** Wide-only header (e.g. `AppHeaderIsland`). Ignored on compact. */
  header?: JSX.Element | undefined;
  /**
   * Wide-only sidebar (`AppHeaderIsland orientation="vertical"`), full height
   * at the window's leading edge, on every screen — an open space included,
   * so the rest of the app is always one click away. Ignored on compact.
   */
  rail?: JSX.Element | undefined;
  children: JSX.Element;
};

function AppFrameWideColumn(props: AppFrameProps): JSX.Element {
  const header = useAppFrameHeader(() => props.header ?? null);
  // A screen drawing its own chrome (an open space) narrows the column so its
  // top bar and everything under it share one pair of edges.
  const ownChrome = useAppFrameHeaderOverridden();
  return (
    <ContentEdgePaddingProvider step={0}>
      <div
        class="box flex-1 min-h-0 min-w-0 w-full mx-auto px-4 pb-4 gap-2"
        classList={{
          'max-w-ui-space': ownChrome(),
          'max-w-ui-wide': !ownChrome(),
        }}
        // The screen's own top bar (52px) and the column gap under it: what a
        // board fitting the window height leaves for that chrome.
        style={{
          '--ui-host-chrome-block-size': ownChrome()
            ? 'calc(var(--ui-control-size-lg) + var(--ui-space-sm))'
            : undefined,
        }}
        data-region="column"
      >
        <Show when={header()}>
          {(node) => (
            <div class="box shrink-0" data-region="header">
              {node()}
            </div>
          )}
        </Show>
        <div class="box flex-1 min-h-0 min-w-0" data-region="content">
          {props.children}
        </div>
      </div>
    </ContentEdgePaddingProvider>
  );
}

function AppFrameWide(props: AppFrameProps): JSX.Element {
  const rail = (): JSX.Element | undefined => props.rail;
  return (
    <main
      class="box flex-1 min-h-0 min-w-0 w-full max-w-full bg-background overflow-clip"
      data-component="AppFrame"
      data-mode="wide"
    >
      <DismissibleBannerPortalProvider>
        <div class="box flex-row flex-1 min-h-0 min-w-0">
          <Show when={rail()}>
            {(node) => (
              <div class="box shrink-0 min-h-0" data-region="rail">
                {node()}
              </div>
            )}
          </Show>
          <div
            class="box flex-1 min-h-0 min-w-0"
            classList={{ 'pt-4': rail() !== undefined }}
          >
            <GlobalTrailingInRail when={rail() !== undefined}>
              <AppFrameWideColumn {...props} />
            </GlobalTrailingInRail>
          </div>
        </div>
      </DismissibleBannerPortalProvider>
    </main>
  );
}

function AppFrameCompact(props: AppFrameProps): JSX.Element {
  return (
    <main
      class="box flex-1 min-h-0 bg-background"
      data-component="AppFrame"
      data-mode="compact"
    >
      <DismissibleBannerPortalProvider>
        <div class="box flex-1 min-h-0 min-w-0" data-region="content">
          {props.children}
        </div>
      </DismissibleBannerPortalProvider>
    </main>
  );
}

/**
 * `AppFrame` -- the root shell. Mobile-first: compact is the full-bleed
 * column; wide is a centered column. One canvas everywhere: the frame paints
 * `background` edge to edge at every width, and nothing inside it (header,
 * top bar, screen bodies) paints a second page tone. `surface` is for wells.
 *
 * Regions (`data-region` on each box AppFrame draws):
 *
 * - **rail** (wide only) -- the `rail` prop, normally the vertical
 *   `AppHeaderIsland`: the app's sidebar, full height at the leading edge,
 *   kept while a screen draws its own top chrome.
 *
 * - **header** (wide only) -- the `header` prop, normally `AppHeaderIsland`:
 *   logo, then the app's top-level **nav**, then actions and the account
 *   menu, over one hairline. A screen may replace or hide it for its
 *   lifetime (`useSetAppFrameHeader`). Compact ignores it: each routed
 *   screen draws its own `TopBar`.
 * - **column** (wide) -- the centered column (`max-w-ui-wide`); while a
 *   screen draws its own chrome it narrows to `max-w-ui-space`, so that
 *   chrome and the screen under it share edges.
 * - **content** -- `children`, the routed screen. It owns its own scrolling
 *   and, on compact, its 16px page edge.
 * - **tab bar** (compact only) -- the bottom `TabBar`, the compact form of
 *   the nav. The tab-root layout draws it at the foot of the content, so it
 *   shows only on the screens that are tabs; AppFrame reserves nothing for
 *   it.
 *
 * Owns {@link DismissibleBannerPortalProvider} so top/bottom banner hosts sit
 * outside the wide column and span the full frame; banner *content* still
 * aligns to the wide measure inside `DismissibleBanner`. Safe-area insets come
 * from the `.safeTop` / `.safeBottom` classes of the chrome inside.
 */
export function AppFrame(props: AppFrameProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <ScreenFocusProvider>
      <Show when={mode() === 'wide'} fallback={<AppFrameCompact {...props} />}>
        <AppFrameWide {...props} />
      </Show>
    </ScreenFocusProvider>
  );
}
