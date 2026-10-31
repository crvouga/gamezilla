/** @jsxImportSource solid-js */

import { type JSX, Show } from 'solid-js';
import { useAppFrameHeader } from '../app-frame-chrome/index';
import { ContentEdgePaddingProvider } from '../content-edge-padding/index';
import { DismissibleBannerPortalProvider } from '../dismissible-top-banner/index';
import { ScreenFocusProvider } from '../screen-focus/index';
import { useLayoutMode } from '../use-layout-mode';

export type AppFrameProps = {
  /** Wide-only header (e.g. `AppHeaderIsland`). Ignored on compact. */
  header?: JSX.Element | undefined;
  children: JSX.Element;
};

function AppFrameWideColumn(props: AppFrameProps): JSX.Element {
  const header = useAppFrameHeader(() => props.header ?? null);
  return (
    <ContentEdgePaddingProvider step={0}>
      <div
        class="box flex-1 min-h-0 min-w-0 w-full max-w-ui-wide mx-auto px-4 pb-4 gap-2"
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
  return (
    <main
      class="box flex-1 min-h-0 min-w-0 w-full max-w-full bg-background overflow-clip"
      data-component="AppFrame"
      data-mode="wide"
    >
      <DismissibleBannerPortalProvider>
        <AppFrameWideColumn {...props} />
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
 * Regions, top to bottom (`data-region` on each box AppFrame draws):
 *
 * - **header** (wide only) -- the `header` prop, normally `AppHeaderIsland`:
 *   logo, then the app's top-level **nav**, then actions and the account
 *   menu, over one hairline. A screen may replace or hide it for its
 *   lifetime (`useSetAppFrameHeader`). Compact ignores it: each routed
 *   screen draws its own `TopBar`.
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
