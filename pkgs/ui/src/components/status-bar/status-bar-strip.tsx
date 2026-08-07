import type { ReactNode } from 'react';
import { useContext } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import type { RegisteredStatusBarItem } from './types';

/** Body height of the thin strip (excluding safe-area inset). */
export const STATUS_BAR_BODY_HEIGHT = 22;

/** z-index below surfaces/banners so modals still cover the strip. */
const STATUS_BAR_Z_INDEX = 1000;

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export type StatusBarStripProps = {
  items: readonly RegisteredStatusBarItem[];
  onPress: () => void;
  accessibilityLabel: string;
  dataSet?: ComponentDataSet;
};

/**
 * Thin smartphone-style strip. Sits in the system safe-area zone on notched
 * devices; on zero-inset platforms (web) uses {@link STATUS_BAR_BODY_HEIGHT}
 * and expects the chrome wrapper to push content so TopBar is not covered.
 */
export function StatusBarStrip({
  items,
  onPress,
  accessibilityLabel,
  dataSet,
}: StatusBarStripProps): ReactNode {
  const theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  const topInset = insets.top;
  const bodyHeight =
    topInset > 0
      ? Math.max(topInset, STATUS_BAR_BODY_HEIGHT)
      : STATUS_BAR_BODY_HEIGHT;

  return (
    <View
      {...componentDataSet('StatusBar', dataSet)}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: STATUS_BAR_Z_INDEX,
        height: bodyHeight,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: 10,
          gap: 8,
          backgroundColor: pressed ? theme.colors.tintSubtle : 'transparent',
        })}
      >
        {items.map((item) => (
          <Box
            key={item.id}
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={item.accessibilityLabel}
          >
            {item.indicator}
          </Box>
        ))}
      </Pressable>
    </View>
  );
}

/**
 * Vertical space the root chrome should reserve below the strip when the
 * device reports no top safe-area inset (so the absolute strip does not cover
 * TopBar content).
 */
export function useStatusBarPushHeight(): number {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  return insets.top > 0 ? 0 : STATUS_BAR_BODY_HEIGHT;
}
