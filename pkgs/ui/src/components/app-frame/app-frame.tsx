/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `AppFrame` -- root shell. Compact: full-bleed column. Wide: flat background
 * with a max-width column and an optional header above the body.
 * Safe-area insets come from CSS `env()`.
 *
 * Owns {@link DismissibleBannerPortalProvider} so top/bottom banner hosts sit
 * outside the wide max-width column and span the full frame; banner *content*
 * still aligns to {@link APP_MAX_WIDTH} inside `DismissibleBanner`.
 */

import { type JSX, Show } from 'solid-js';
import {
  APP_FRAME_GUTTER_STEP,
  APP_MAX_WIDTH,
  ISLAND_GAP_STEP,
  useLayoutMode,
} from '../../theme';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { DismissibleBannerPortalProvider } from '../dismissible-top-banner';
import { ScreenFocusProvider } from '../screen-base/screen-focus';
import { useAppFrameHeader } from './app-frame-chrome';

export type AppFrameProps = {
  /** Wide-only header (e.g. `AppHeaderIsland`). Ignored on compact. */
  header?: JSX.Element | undefined;
  children: JSX.Element;
};

function AppFrameWideColumn(props: AppFrameProps): JSX.Element {
  const header = useAppFrameHeader(() => props.header ?? null);
  const gutter = `${APP_FRAME_GUTTER_STEP * 4}px`;
  return (
    <ContentEdgePaddingProvider step={0}>
      <div
        class="box flex-1 min-h-0 min-w-0 w-full"
        style={{
          'max-width': `min(${cssPx(APP_MAX_WIDTH)}, 100%)`,
          'margin-left': 'auto',
          'margin-right': 'auto',
          'padding-left': gutter,
          'padding-right': gutter,
          'padding-top': '0px',
          'padding-bottom': gutter,
          gap: `${ISLAND_GAP_STEP * 4}px`,
        }}
      >
        {header()}
        <div class="box flex-1 min-h-0 min-w-0">{props.children}</div>
      </div>
    </ContentEdgePaddingProvider>
  );
}

function AppFrameWide(props: AppFrameProps): JSX.Element {
  return (
    <main
      class="box flex-1 min-h-0 min-w-0 w-full max-w-full bg-background"
      data-component="AppFrame"
      data-mode="wide"
      style={{ overflow: 'clip' }}
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
      class="box flex-1 min-h-0"
      data-component="AppFrame"
      data-mode="compact"
    >
      <DismissibleBannerPortalProvider>
        {props.children}
      </DismissibleBannerPortalProvider>
    </main>
  );
}

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
