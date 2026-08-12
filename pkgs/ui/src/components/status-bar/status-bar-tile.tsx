/**
 * Uniform Control Center quick-action tile. Icon on top, title + caption
 * below; `active` fills with brand tint for toggle-on state.
 */

import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import { borderRadius, OnColorProvider, useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

const TILE_MIN_HEIGHT = 112;
const ICON_WELL_SIZE = 40;

export type StatusBarTileProps = {
  title: ReactNode;
  caption?: ReactNode;
  leading?: ReactNode;
  active?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  dataSet?: ComponentDataSet;
};

export function StatusBarTile({
  title,
  caption,
  leading,
  active = false,
  onPress,
  accessibilityLabel,
  testID,
  dataSet,
}: StatusBarTileProps): ReactNode {
  const theme = useTheme();
  const pressable = onPress !== undefined;
  const glass =
    theme.colorScheme === 'dark'
      ? 'hsla(0, 0%, 100%, 0.12)'
      : 'hsla(240, 10%, 4%, 0.06)';
  const backgroundColor = active ? theme.colors.tint : glass;
  const wellFill = active ? 'hsla(0, 0%, 100%, 0.22)' : glass;

  const body = (
    <Box
      sx={{
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        justifyContent: 'space-between',
        gap: 2.5,
        backgroundColor,
        borderRadius: borderRadius.xl,
        minHeight: TILE_MIN_HEIGHT,
      }}
      dataSet={{ component: 'StatusBarTile', ...dataSet }}
    >
      <OnColorProvider background={backgroundColor}>
        {leading !== undefined ? (
          <Box
            sx={{
              width: ICON_WELL_SIZE,
              height: ICON_WELL_SIZE,
              borderRadius: borderRadius.full,
              backgroundColor: wellFill,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {leading}
          </Box>
        ) : null}
        <Box sx={{ gap: 0.5 }}>
          <Text variant="label" numberOfLines={1} label={title} />
          {caption !== undefined ? (
            <Text variant="caption" numberOfLines={2} label={caption} />
          ) : null}
        </Box>
      </OnColorProvider>
    </Box>
  );

  if (!pressable) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      feedback="opacity"
      sx={{ flex: 1 }}
      {...(testID !== undefined ? { testID } : {})}
    >
      {body}
    </Pressable>
  );
}
