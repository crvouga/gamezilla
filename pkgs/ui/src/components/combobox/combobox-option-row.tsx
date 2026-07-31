import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../theme';
import { FlatList } from '../flat-list';
import { ListItem } from '../list';
import { Text } from '../text';
import type { ComboboxOption, ComboboxProps } from './combobox-types';

export function ComboboxOptionRow<T extends string | number>({
  item,
  isSelected,
  onPick,
  renderOption,
}: {
  item: ComboboxOption<T>;
  isSelected: boolean;
  onPick: () => void;
  renderOption: ComboboxProps<T>['renderOption'];
}): ReactElement {
  const theme = useTheme();
  if (renderOption !== undefined) {
    return renderOption(item, isSelected, onPick) ?? <View />;
  }
  return (
    <ListItem
      title={item.label}
      leading={item.preview}
      trailing={
        isSelected ? (
          <Text style={{ color: theme.colors.tint, fontSize: 16 }} label="✓" />
        ) : undefined
      }
      onPress={onPick}
    />
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

export function ComboboxOptionsList<T extends string | number>({
  options,
  value,
  onPick,
  renderOption,
}: {
  options: ComboboxOption<T>[];
  value: T | null | undefined;
  onPick: (next: T) => void;
  renderOption: ComboboxProps<T>['renderOption'];
}): ReactElement {
  return (
    <FlatList
      data={options}
      keyExtractor={(item) => String(item.value)}
      style={{ maxHeight: 360 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <ComboboxOptionRow
          item={item}
          isSelected={item.value === value}
          onPick={() => onPick(item.value)}
          renderOption={renderOption}
        />
      )}
    />
  );
}
