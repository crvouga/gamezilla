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
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
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
  if (!separator) {
    return <Box dataSet={{ component: 'List', ...dataSet }}>{children}</Box>;
  }

  const items = Children.toArray(children);
  return (
    <Box dataSet={{ component: 'List', ...dataSet }}>
      {items.map((child, i) => (
        <Box key={i}>
          {child}
          {i < items.length - 1 && (
            <Box
              sx={{
                borderBottomWidth: 'hairline',
                borderColor: 'border',
                marginLeft: 16,
              }}
            />
          )}
        </Box>
      ))}
    </Box>
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
}: {
  title: ReactNode;
  subtitle: ReactNode | undefined;
  leading: ReactNode | undefined;
  trailing: ReactNode | undefined;
}) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 3,
      }}
    >
      {leading}
      <Box sx={{ flex: 1 }}>
        <Text variant="body" label={title} />
        {subtitle && <Text variant="caption" label={subtitle} />}
      </Box>
      {trailing}
    </Box>
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
  const content = (
    <ListItemContent
      title={title}
      subtitle={subtitle}
      leading={leading}
      trailing={trailing}
    />
  );
  const selectedSx = selected
    ? { backgroundColor: 'tintSubtle' as const }
    : false;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        sx={selectedSx}
        dataSet={{ component: 'ListItem', ...dataSet }}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Box sx={selectedSx} dataSet={{ component: 'ListItem', ...dataSet }}>
      {content}
    </Box>
  );
}
