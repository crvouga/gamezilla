/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `AppFrame` -- root shell. Compact: full-bleed column. Wide: sunken canvas
 * with a max-width, gutters, and an optional header island above the body.
 * Safe-area insets come from CSS `env()`.
 */

import { type JSX, Show } from 'solid-js';
import {
  APP_FRAME_GUTTER_STEP,
  APP_MAX_WIDTH,
  ISLAND_GAP_STEP,
  useLayoutMode,
} from '../../theme';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { useAppFrameHeader } from './app-frame-chrome';

export type AppFrameProps = {
  /** Wide-only header island (e.g. `AppHeaderIsland`). Ignored on compact. */
  header?: JSX.Element | undefined;
  children: JSX.Element;
};

function AppFrameWide(props: AppFrameProps): JSX.Element {
  const header = useAppFrameHeader(() => props.header ?? null);
  return (
    <main
      class="box flex-1 min-h-[0] min-w-[0] w-[100%] max-w-[100%] bg-surface-sunken"
      data-component="AppFrame"
      data-mode="wide"
      style={{ overflow: 'clip' }}
    >
      <ContentEdgePaddingProvider step={0}>
        <div
          class="box flex-1 min-h-[0] min-w-[0] w-[100%]"
          style={{
            'max-width': `min(${cssPx(APP_MAX_WIDTH)}, 100%)`,
            'margin-left': 'auto',
            'margin-right': 'auto',
            'padding-left': `${APP_FRAME_GUTTER_STEP * 4}px`,
            'padding-right': `${APP_FRAME_GUTTER_STEP * 4}px`,
            'padding-top': `${APP_FRAME_GUTTER_STEP * 4}px`,
            'padding-bottom': `${APP_FRAME_GUTTER_STEP * 4}px`,
            gap: `${ISLAND_GAP_STEP * 4}px`,
          }}
        >
          {header()}
          <div class="box flex-1 min-h-[0] min-w-[0]">{props.children}</div>
        </div>
      </ContentEdgePaddingProvider>
    </main>
  );
}

export function AppFrame(props: AppFrameProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <main
          class="box flex-1 min-h-[0]"
          data-component="AppFrame"
          data-mode="compact"
        >
          {props.children}
        </main>
      }
    >
      <AppFrameWide {...props} />
    </Show>
  );
}
