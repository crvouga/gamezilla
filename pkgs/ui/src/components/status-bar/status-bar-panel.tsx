import type { ReactNode } from 'react';

import { Box } from '../box';
import { Divider } from '../divider';
import { Stack } from '../stack';
import { Text } from '../text';
import type { RegisteredStatusBarItem } from './types';

export type StatusBarPanelProps = {
  items: readonly RegisteredStatusBarItem[];
};

function StatusBarSection({
  item,
  showDivider,
}: {
  item: RegisteredStatusBarItem;
  showDivider: boolean;
}): ReactNode {
  return (
    <Box>
      {showDivider ? (
        <Box sx={{ my: 4 }}>
          <Divider />
        </Box>
      ) : null}
      <Stack spacing={3}>
        <Stack direction="horizontal" spacing={3} align="center">
          {item.leading !== undefined ? item.leading : null}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyBold" label={item.title} />
            {item.caption !== undefined ? (
              <Text
                variant="caption"
                sx={{ color: 'textSecondary' }}
                label={item.caption}
              />
            ) : null}
          </Box>
        </Stack>
        <Box>{item.panel}</Box>
      </Stack>
    </Box>
  );
}

/**
 * Control-center body sections (non-scrolling). The overlay owns the scroller
 * so dismiss gestures can coordinate with scroll position.
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

  return (
    <Stack spacing={0} sx={{ pb: 4 }}>
      {items.map((item, index) => (
        <StatusBarSection key={item.id} item={item} showDivider={index > 0} />
      ))}
    </Stack>
  );
}
