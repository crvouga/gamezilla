/**
 * `Picker` — trigger row that opens a {@link ResponsiveSurface} with a
 * scrollable option list (single select).
 */

import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { List, ListItem } from '../list';
import { Text } from '../text';
import { ResponsiveSurface } from '../responsive-surface';

export type PickerOption<T extends string | number = string> = {
  label: string;
  value: T;
  preview?: ReactNode;
};

export type PickerProps<T extends string | number = string> = {
  options: PickerOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Optional label above the trigger. */
  label?: string;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Custom row renderer; default uses {@link ListItem}. */
  renderOption?: (
    option: PickerOption<T>,
    selected: boolean,
    onPick: () => void
  ) => ReactElement | null;
};

export function Picker<T extends string | number = string>({
  options,
  value,
  onValueChange,
  label,
  surfaceTitle,
  disabled = false,
  placeholder = 'Select…',
  renderOption,
}: PickerProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  const title =
    surfaceTitle !== undefined
      ? surfaceTitle
      : label !== undefined
        ? label
        : 'Choose';

  const defaultRender = useMemo(
    () =>
      function DefaultRender(
        item: PickerOption<T>,
        isSelected: boolean,
        onPick: () => void
      ) {
        return (
          <ListItem
            title={item.label}
            leading={item.preview}
            trailing={
              isSelected ? (
                <Text
                  style={{ color: theme.colors.tint, fontSize: 16 }}
                  label="✓"
                />
              ) : undefined
            }
            onPress={onPick}
          />
        );
      },
    [theme.colors.tint]
  );

  return (
    <>
      {label !== undefined && (
        <Text
          variant="caption"
          sx={{ mb: 0.5 }}
          style={{ color: theme.colors.textSecondary }}
          label={label}
        />
      )}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            gap: 10,
          },
          pressed && { opacity: 0.7 },
          disabled && { opacity: 0.4 },
        ]}
      >
        {selected?.preview !== undefined ? (
          <View style={{ flexShrink: 0 }}>{selected.preview}</View>
        ) : null}
        <Text
          variant="label"
          style={{
            flex: 1,
            color: selected ? theme.colors.text : theme.colors.textSecondary,
          }}
          label={selected?.label ?? placeholder}
        />
        <Text
          style={{ color: theme.colors.textSecondary, fontSize: 10 }}
          label="▼"
        />
      </Pressable>

      <ResponsiveSurface
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
      >
        {renderOption !== undefined ? (
          <FlatList
            data={options}
            keyExtractor={(_item, index) => String(index)}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const row = renderOption(item, item.value === value, () => {
                onValueChange(item.value);
                setOpen(false);
              });
              return row ?? <View />;
            }}
          />
        ) : (
          <List separator>
            {options.map((item, index) => {
              const isSelected = item.value === value;
              const onPick = () => {
                onValueChange(item.value);
                setOpen(false);
              };
              return (
                <View key={String(item.value) + String(index)}>
                  {defaultRender(item, isSelected, onPick)}
                </View>
              );
            })}
          </List>
        )}
      </ResponsiveSurface>
    </>
  );
}
