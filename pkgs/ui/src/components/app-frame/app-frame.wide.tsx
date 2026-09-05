/**
 * Wide AppFrame: sunken canvas with a centered max-width column. Renders the
 * optional header island above the navigator content (override wins).
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import {
  APP_FRAME_GUTTER_STEP,
  APP_MAX_WIDTH,
  ISLAND_GAP_STEP,
} from '../../theme/layout';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { useAppFrameHeader } from './app-frame-chrome';
import type { AppFrameProps } from './app-frame-types';

export function AppFrameWide({ header, children }: AppFrameProps): ReactNode {
  const resolvedHeader = useAppFrameHeader(header ?? null);
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, background: 'surfaceSunken' }}
      {...componentDataSet('AppFrame', undefined)}
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
          {resolvedHeader}
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
        </Box>
      </ContentEdgePaddingProvider>
    </Box>
  );
}
