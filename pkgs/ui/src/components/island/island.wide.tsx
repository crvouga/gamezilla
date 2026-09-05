/**
 * Wide Island: elevated card with optional title row and content-edge padding
 * so nested flush-edge lists stay flush with the island edge.
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import { ISLAND_PADDING_STEP, ISLAND_RADIUS } from '../../theme/layout';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { Text } from '../text';
import type { IslandProps } from './island-types';

function IslandTitleRow({
  title,
  caption,
  actions,
}: {
  title: ReactNode;
  caption?: ReactNode;
  actions?: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text variant="subtitle" label={title} />
        {caption !== undefined && caption !== null ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={caption}
          />
        ) : null}
      </Box>
      {actions}
    </Box>
  );
}

export function IslandWide({
  title,
  caption,
  actions,
  children,
  sx,
  dataSet,
}: IslandProps): ReactNode {
  const hasTitle = title !== undefined && title !== null;
  return (
    <Box
      sx={[
        {
          backgroundColor: 'surfaceElevated',
          borderRadius: ISLAND_RADIUS,
          borderWidth: 1,
          borderColor: 'border',
          elevation: 1,
          overflow: 'hidden',
          p: ISLAND_PADDING_STEP,
        },
        sx,
      ]}
      {...componentDataSet('Island', dataSet)}
    >
      <ContentEdgePaddingProvider step={ISLAND_PADDING_STEP}>
        {hasTitle ? (
          <IslandTitleRow
            title={title}
            {...(caption !== undefined ? { caption } : {})}
            {...(actions !== undefined ? { actions } : {})}
          />
        ) : null}
        {children}
      </ContentEdgePaddingProvider>
    </Box>
  );
}
