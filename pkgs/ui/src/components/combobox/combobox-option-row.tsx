import type { ReactElement, ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { useTheme } from '../../theme';
import { FlatList } from '../flat-list';
import { ListItem } from '../list';
import { Text } from '../text';
import type { ComboboxOption, ComboboxProps } from './combobox-types';

export function ComboboxOptionRow<T extends string | number>({
  item,
  isSelected,
  isHighlighted,
  optionId,
  onPick,
  renderOption,
}: {
  item: ComboboxOption<T>;
  isSelected: boolean;
  isHighlighted: boolean;
  optionId: string;
  onPick: () => void;
  renderOption: ComboboxProps<T>['renderOption'];
}): ReactElement {
  const theme = useTheme();
  if (renderOption !== undefined) {
    return renderOption(item, isSelected, onPick) ?? <View />;
  }
  return (
    <View
      nativeID={optionId}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSelected }}
      style={
        isHighlighted
          ? { backgroundColor: theme.colors.tintHighlight }
          : undefined
      }
      {...(Platform.OS === 'web' ? { id: optionId } : {})}
    >
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
    </View>
  );
}

export function ComboboxEmpty({
  emptyMessage,
}: {
  emptyMessage: ReactNode | undefined;
}): ReactElement | null {
  if (emptyMessage === undefined) return null;
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label={emptyMessage}
      />
    </View>
  );
}

function isValueSelected<T extends string | number>(
  value: T | null | undefined,
  values: ReadonlySet<T> | undefined,
  itemValue: T
): boolean {
  if (values !== undefined) return values.has(itemValue);
  return itemValue === value;
}

export function ComboboxOptionsList<T extends string | number>({
  options,
  value,
  values,
  highlightedIndex,
  listboxId,
  onPick,
  renderOption,
}: {
  options: ComboboxOption<T>[];
  value: T | null | undefined;
  values: ReadonlySet<T> | undefined;
  highlightedIndex: number;
  listboxId: string;
  onPick: (next: T) => void;
  renderOption: ComboboxProps<T>['renderOption'];
}): ReactElement {
  return (
    <FlatList
      data={options}
      keyExtractor={(item) => String(item.value)}
      style={{ maxHeight: 360 }}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="list"
      nativeID={listboxId}
      {...(Platform.OS === 'web' ? { id: listboxId } : {})}
      renderItem={({ item, index }) => (
        <ComboboxOptionRow
          item={item}
          isSelected={isValueSelected(value, values, item.value)}
          isHighlighted={index === highlightedIndex}
          optionId={`${listboxId}-opt-${index}`}
          onPick={() => onPick(item.value)}
          renderOption={renderOption}
        />
      )}
    />
  );
}
