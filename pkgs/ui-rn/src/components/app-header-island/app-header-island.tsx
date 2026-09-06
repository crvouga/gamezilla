/**
 * `AppHeaderIsland` -- wide-only top chrome: logo | pill tabs | trailing.
 * Mounted via {@link AppFrame} `header`; not used on compact layouts.
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { ISLAND_RADIUS } from '../../theme/layout';
import { getTopBarContentHeight } from '../../theme/use-action-bar-chrome';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';
import type {
  AppHeaderIslandItem,
  AppHeaderIslandProps,
} from './app-header-island-types';

export type {
  AppHeaderIslandItem,
  AppHeaderIslandProps,
} from './app-header-island-types';

function HeaderPill({ item }: { item: AppHeaderIslandItem }): ReactNode {
  const theme = useTheme();
  const Icon = item.icon;
  const color = item.active ? theme.colors.text : theme.colors.textSecondary;
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: item.active }}
      accessibilityLabel={item.label}
      {...(item.testID !== undefined ? { testID: item.testID } : {})}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        py: 1.5,
        borderRadius: 'full',
        backgroundColor: item.active ? 'surface' : 'transparent',
      }}
    >
      <Icon size={18} color={color} />
      <Text
        variant="label"
        sx={{
          color: item.active ? 'text' : 'textSecondary',
          fontWeight: item.active ? '600' : '500',
        }}
        label={item.label}
      />
    </Pressable>
  );
}

function HeaderPillGroup({
  items,
}: {
  items: readonly AppHeaderIslandItem[];
}): ReactNode {
  return (
    <Box
      accessibilityRole="tablist"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 'full',
        backgroundColor: 'surfaceMuted',
      }}
    >
      {items.map((item) => (
        <HeaderPill key={item.id} item={item} />
      ))}
    </Box>
  );
}

export function AppHeaderIsland({
  leading,
  items,
  trailing,
}: AppHeaderIslandProps): ReactNode {
  const { breakpoint } = useTheme();
  const contentHeight = getTopBarContentHeight(breakpoint);
  const pills = items ?? [];
  return (
    <Box
      {...componentDataSet('AppHeaderIsland', undefined)}
      sx={{
        backgroundColor: 'surfaceElevated',
        borderRadius: ISLAND_RADIUS,
        borderWidth: 1,
        borderColor: 'border',
        elevation: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          px: 3,
          height: contentHeight,
          minHeight: contentHeight,
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          {leading}
        </Box>
        {pills.length > 0 ? (
          <Box sx={{ flexShrink: 0 }}>
            <HeaderPillGroup items={pills} />
          </Box>
        ) : null}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {trailing}
        </Box>
      </Box>
    </Box>
  );
}
