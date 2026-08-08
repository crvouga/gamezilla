/**
 * Uniform Control Center quick-action tile. Icon on top, title + caption
 * below; `active` fills with brand tint for toggle-on state.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { borderRadius, OnColorProvider, useTheme } from '../../theme';
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
  dataSet?: ComponentDataSet;
};

export function StatusBarTile({
  title,
  caption,
  leading,
  active = false,
  onPress,
  accessibilityLabel,
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
    <View
      style={[
        styles.tile,
        {
          backgroundColor,
          borderRadius: borderRadius.xl,
          minHeight: TILE_MIN_HEIGHT,
        },
      ]}
      {...componentDataSet('StatusBarTile', dataSet)}
    >
      <OnColorProvider background={backgroundColor}>
        {leading !== undefined ? (
          <View
            style={[
              styles.iconWell,
              {
                width: ICON_WELL_SIZE,
                height: ICON_WELL_SIZE,
                borderRadius: borderRadius.full,
                backgroundColor: wellFill,
              },
            ]}
          >
            {leading}
          </View>
        ) : null}
        <View style={styles.labels}>
          <Text variant="label" numberOfLines={1} label={title} />
          {caption !== undefined ? (
            <Text variant="caption" numberOfLines={2} label={caption} />
          ) : null}
        </View>
      </OnColorProvider>
    </View>
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
      style={styles.pressable}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  tile: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
    gap: 10,
  },
  iconWell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labels: {
    gap: 2,
  },
});
