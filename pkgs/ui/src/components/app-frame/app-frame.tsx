/** @jsxImportSource solid-js */
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
import { Box } from '../box';
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
    <Box
      as="main"
      sx={{ flex: 1, minHeight: 0, background: 'surfaceSunken' }}
      dataSet={{ component: 'AppFrame', mode: 'wide' }}
    >
      <ContentEdgePaddingProvider step={0}>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            maxWidth: APP_MAX_WIDTH,
            alignSelf: 'center',
            px: APP_FRAME_GUTTER_STEP,
            pt: APP_FRAME_GUTTER_STEP,
            pb: APP_FRAME_GUTTER_STEP,
            gap: ISLAND_GAP_STEP,
          }}
        >
          {header()}
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            {props.children}
          </Box>
        </Box>
      </ContentEdgePaddingProvider>
    </Box>
  );
}

export function AppFrame(props: AppFrameProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <Box
          as="main"
          sx={{ flex: 1, minHeight: 0 }}
          dataSet={{ component: 'AppFrame', mode: 'compact' }}
        >
          {props.children}
        </Box>
      }
    >
      <AppFrameWide {...props} />
    </Show>
  );
}
