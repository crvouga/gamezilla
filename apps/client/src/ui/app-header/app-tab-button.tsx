/**
 * Standalone top-level tab button shared by the desktop header bar and the
 * mobile bottom tab bar. Matches React Navigation's default below-icon layout
 * (icon over label, 13pt label, brand tint when selected).
 */

import { Pressable, Text, TOP_BAR_CONTENT_HEIGHT } from '@pkgs/ui';
import type { ReactNode } from 'react';

/** Fixed slot width for header tabs (desktop center strip). */
export const HEADER_TAB_WIDTH = 160;

const TAB_ICON_SIZE = 24;
const TAB_LABEL_FONT_SIZE = 13;
const TAB_VERTICAL_PADDING = 5;

export type AppTabButtonLayout = 'header' | 'bottom';

export type AppTabButtonProps = {
  layout: AppTabButtonLayout;
  label: string;
  icon: ReactNode;
  focused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

export function AppTabButton({
  layout,
  label,
  icon,
  focused,
  onPress,
  onLongPress,
  accessibilityLabel,
}: AppTabButtonProps): ReactNode {
  const layoutSx =
    layout === 'header'
      ? { width: HEADER_TAB_WIDTH }
      : { flex: 1, minWidth: 0 };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      sx={{
        ...layoutSx,
        height: TOP_BAR_CONTENT_HEIGHT,
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
