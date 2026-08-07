/**
 * `List` / `ListItem` -- structured list with leading, trailing, and separator support.
 *
 * `ListItem` uses the themed {@link Pressable} so hover (web) + press feedback
 * are picked up automatically. Pass `selected` to render the row with a
 * `tintSubtle` fill -- typical for current-section indicators.
 *
 * @example
 * ```tsx
 * <List>
 *   <ListItem title="Profile" subtitle="Edit your info" onPress={goProfile} />
 *   <ListItem title="Settings" trailing={<Text label="›" variant="caption" />} onPress={goSettings} />
 * </List>
 * ```
 */

import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type ListProps = {
  children: ReactNode;
  /** Show hairline separators between items. Defaults to true. */
  separator?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function List({ children, separator = true, dataSet }: ListProps) {
  const theme = useTheme();

  if (!separator) {
    return <View {...componentDataSet('List', dataSet)}>{children}</View>;
  }

  const items = Children.toArray(children);
  return (
    <View {...componentDataSet('List', dataSet)}>
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
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rendered at the start (left). */
  leading?: ReactNode;
  /** Rendered at the end (right). */
  trailing?: ReactNode;
  /** Render with a `tintSubtle` background to indicate current selection. */
  selected?: boolean;
  onPress?: () => void;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function ListItemContent({
  title,
  subtitle,
  leading,
  trailing,
  selected,
}: {
  title: ReactNode;
  subtitle: ReactNode | undefined;
  leading: ReactNode | undefined;
  trailing: ReactNode | undefined;
  selected: boolean;
}) {
  return (
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
      {selected ? null : null}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  selected = false,
  onPress,
  dataSet,
}: ListItemProps) {
  const theme = useTheme();
  const content = (
    <ListItemContent
      title={title}
      subtitle={subtitle}
      leading={leading}
      trailing={trailing}
      selected={selected}
    />
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: selected ? theme.colors.tintSubtle : undefined,
        }}
        {...componentDataSet('ListItem', dataSet)}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        backgroundColor: selected ? theme.colors.tintSubtle : undefined,
      }}
      {...componentDataSet('ListItem', dataSet)}
    >
      {content}
    </View>
  );
}
