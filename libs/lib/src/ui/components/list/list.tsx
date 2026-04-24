/**
 * `List` / `ListItem` -- structured list with leading, trailing, and separator support.
 *
 * @example
 * ```tsx
 * <List>
 *   <ListItem title="Profile" subtitle="Edit your info" onPress={goProfile} />
 *   <ListItem title="Settings" trailing={<Text label="›" variant="caption" />} onPress={goSettings} />
 * </List>
 * ```
 */

import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type ListProps = {
  children: ReactNode;
  /** Show hairline separators between items. Defaults to true. */
  separator?: boolean;
};

export function List({ children, separator = true }: ListProps) {
  const theme = useTheme();

  if (!separator) return <View>{children}</View>;

  const items = Array.isArray(children) ? children : [children];
  return (
    <View>
      {items.map((child, i) => (
        <View key={i}>
          {child}
          {i < items.length - 1 && (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.border,
                marginLeft: 16,
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Rendered at the start (left). */
  leading?: ReactNode;
  /** Rendered at the end (right). */
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
}: ListItemProps) {
  const theme = useTheme();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="body" label={title} />
        {subtitle && <Text variant="caption" label={subtitle} />}
      </View>
      {trailing}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          pressed && { backgroundColor: theme.colors.surface },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
