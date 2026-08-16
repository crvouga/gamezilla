/**
 * Single folder-shaped tab cell for {@link TabStrip}.
 *
 * Layout is identical for active / inactive: same border box, height, padding,
 * font weight, and reserved separator / close slots. Visual differences are
 * color / opacity / an out-of-flow hairline cover only.
 */

import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { useHoverCapable, useTheme } from '../../theme';
import { Box } from '../box';
import { XIcon } from '../icons';
import { Pressable } from '../pressable';
import { Text } from '../text';
import type { TabStripItem } from './tab-strip-types';

export const TAB_MIN_HEIGHT = 32;
export const TAB_MIN_WIDTH = 88;
export const TAB_MAX_WIDTH = 220;

export function TabStripTab(props: {
  readonly item: TabStripItem;
  readonly active: boolean;
  /** When true, keep a fixed separator gutter (opacity follows `separatorVisible`). */
  readonly reserveSeparatorBefore: boolean;
  readonly separatorVisible: boolean;
  readonly onSelect: (id: string) => void;
  readonly onLayout?: (id: string, x: number, width: number) => void;
}) {
  const theme = useTheme();
  const hoverCapable = useHoverCapable();
  const [hovered, setHovered] = useState(false);
  const {
    item,
    active,
    reserveSeparatorBefore,
    separatorVisible,
    onSelect,
    onLayout,
  } = props;
  const closable = item.onClose !== undefined;
  const showClose = closable && (active || !hoverCapable || hovered);
  const Icon = item.icon;
  const iconColor = active ? theme.colors.tint : theme.colors.textSecondary;

  return (
    <Box
      sx={cellSx}
      onLayout={(e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout;
        onLayout?.(item.id, x, width);
      }}
    >
      {reserveSeparatorBefore ? (
        <Box
          sx={{
            ...separatorSx,
            opacity: separatorVisible ? 1 : 0,
          }}
        />
      ) : null}
      <Box sx={tabShellSx}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          onPress={() => onSelect(item.id)}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          sx={{
            ...tabChromeSx(closable),
            borderColor: active ? 'border' : 'transparent',
            background: active ? 'background' : 'transparent',
            zIndex: active ? 1 : 0,
          }}
        >
          {Icon !== undefined ? (
            <Box sx={iconSlotSx}>
              <Icon size={14} color={iconColor} />
            </Box>
          ) : null}
          <Text
            variant="label"
            label={item.label}
            numberOfLines={1}
            sx={{
              flexShrink: 1,
              color: active ? 'text' : 'textSecondary',
              fontWeight: '600',
              lineHeight: 18,
            }}
          />
          {closable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => item.onClose?.()}
              disabled={!showClose}
              sx={{
                ...closeSx,
                opacity: showClose ? 1 : 0,
              }}
            >
              <XIcon size={12} color={theme.colors.textSecondary} />
            </Pressable>
          ) : null}
        </Pressable>
        {active ? <Box pointerEvents="none" sx={hairlineCoverSx} /> : null}
      </Box>
    </Box>
  );
}

function tabChromeSx(closable: boolean) {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    height: TAB_MIN_HEIGHT,
    minWidth: TAB_MIN_WIDTH,
    maxWidth: TAB_MAX_WIDTH,
    paddingLeft: 5,
    paddingRight: closable ? 2 : 5,
    borderTopLeftRadius: 'md',
    borderTopRightRadius: 'md',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  } as const;
}

const cellSx = {
  flexDirection: 'row',
  alignItems: 'center',
  flexShrink: 0,
  height: TAB_MIN_HEIGHT,
} as const;

const tabShellSx = {
  position: 'relative',
  flexShrink: 0,
  height: TAB_MIN_HEIGHT,
} as const;

const separatorSx = {
  width: 1,
  height: 14,
  marginHorizontal: 2,
  background: 'border',
  flexShrink: 0,
} as const;

const iconSlotSx = {
  width: 14,
  height: 14,
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as const;

const closeSx = {
  padding: 1.5,
  borderRadius: 'sm',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 22,
  height: 22,
} as const;

const hairlineCoverSx = {
  position: 'absolute',
  left: 1,
  right: 1,
  bottom: -1,
  height: 2,
  background: 'background',
  zIndex: 2,
} as const;
