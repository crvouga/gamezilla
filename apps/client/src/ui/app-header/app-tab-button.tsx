/**
 * Bottom tab button matching React Navigation's below-icon layout
 * (icon over label, 13pt label, brand tint when selected).
 */

import { getTopBarContentHeight, Pressable, Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

const TAB_ICON_SIZE = 24;
const TAB_LABEL_FONT_SIZE = 13;
const TAB_VERTICAL_PADDING = 5;

export type AppTabButtonProps = {
  label: string;
  icon: ReactNode;
  focused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

export function AppTabButton({
  label,
  icon,
  focused,
  onPress,
  onLongPress,
  accessibilityLabel,
}: AppTabButtonProps): ReactNode {
  const { breakpoint } = useTheme();
  const tabBarHeight = getTopBarContentHeight(breakpoint);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      sx={{
        flex: 1,
        minWidth: 0,
        height: tabBarHeight,
        minHeight: tabBarHeight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: TAB_VERTICAL_PADDING,
        gap: 1,
      }}
    >
      {icon}
      <Text
        variant="caption"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ fontSize: TAB_LABEL_FONT_SIZE }}
        sx={{ color: focused ? 'tint' : 'tabIconDefault' }}
        label={label}
      />
    </Pressable>
  );
}

/** Icon size passed to `tabBarIcon` render props. */
export const APP_TAB_ICON_SIZE = TAB_ICON_SIZE;
