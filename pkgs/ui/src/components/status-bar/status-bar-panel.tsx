import type { ReactNode } from 'react';

import { Box } from '../box';
import { Stack } from '../stack';
import { Text } from '../text';
import { StatusBarTile } from './status-bar-tile';
import type { RegisteredStatusBarItem } from './types';

export type StatusBarPanelProps = {
  items: readonly RegisteredStatusBarItem[];
};

const GRID_GAP = 3;

function chunkPairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

/**
 * Control Center body — uniform 2-column quick-action tiles.
 */
export function StatusBarPanel({ items }: StatusBarPanelProps): ReactNode {
  if (items.length === 0) {
    return (
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
        label="No status items registered."
      />
    );
  }

  const rows = chunkPairs(items);

  return (
    <Stack spacing={GRID_GAP} sx={{ pb: 2, alignSelf: 'stretch' }}>
      {rows.map((pair) => {
        const rowKey = pair.map((item) => item.id).join(':');
        return (
          <Stack key={rowKey} direction="horizontal" spacing={GRID_GAP}>
            {pair.map((item) => (
              <Box key={item.id} sx={{ flex: 1, minWidth: 0 }}>
                <StatusBarTile
                  title={item.title}
                  active={item.active === true}
                  {...(item.caption !== undefined
                    ? { caption: item.caption }
                    : {})}
                  {...(item.leading !== undefined
                    ? { leading: item.leading }
                    : {})}
                  {...(item.onPress !== undefined
                    ? { onPress: item.onPress }
                    : {})}
                  {...(item.accessibilityLabel !== undefined
                    ? { accessibilityLabel: item.accessibilityLabel }
                    : {})}
                  {...(item.testID !== undefined
                    ? { testID: item.testID }
                    : {})}
                />
              </Box>
            ))}
            {pair.length === 1 ? <Box sx={{ flex: 1 }} /> : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
