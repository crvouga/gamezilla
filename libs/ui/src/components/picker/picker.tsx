/**
 * `Picker` — trigger row that opens a {@link ResponsiveSurface} with a
 * scrollable option list (single select).
 */

import type { LocalizedString } from '@gamezilla/lib/i18n';
import { useLingui } from '@lingui/react/macro';
import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { List, ListItem } from '../list';
import { ResponsiveSurface } from '../responsive-surface';
import { Text } from '../text';

export type PickerOption<T extends string | number = string> = {
  label: ReactNode;
  value: T;
  preview?: ReactNode;
};

export type PickerProps<T extends string | number = string> = {
  options: PickerOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Optional label above the trigger. */
  label?: ReactNode;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: ReactNode;
  disabled?: boolean;
  placeholder?: LocalizedString;
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
  placeholder,
  renderOption,
}: PickerProps<T>) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const placeholderResolved = placeholder ?? t`Select…`;
  const title: ReactNode =
    surfaceTitle !== undefined
      ? surfaceTitle
      : label !== undefined
        ? label
        : t`Choose`;
  const handlePick = (next: T) => {
    onValueChange(next);
    setOpen(false);
  };

  return (
    <>
      {label !== undefined ? <PickerLabel label={label} /> : null}
      <PickerTrigger
        selected={selected}
        placeholder={placeholderResolved}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <ResponsiveSurface
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
      >
        <PickerOptions
          options={options}
          value={value}
          onPick={handlePick}
          renderOption={renderOption}
        />
      </ResponsiveSurface>
    </>
  );
}

function PickerLabel({ label }: { label: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      variant="caption"
      sx={{ mb: 0.5 }}
      style={{ color: theme.colors.textSecondary }}
      label={label}
    />
  );
}

function PickerTrigger<T extends string | number>({
  selected,
  placeholder,
  disabled,
  onPress,
}: {
  selected: PickerOption<T> | undefined;
  placeholder: LocalizedString;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
          color:
            selected !== undefined
              ? theme.colors.text
              : theme.colors.textSecondary,
        }}
        label={selected?.label ?? placeholder}
      />
      <Text
        style={{ color: theme.colors.textSecondary, fontSize: 10 }}
        label="▼"
      />
    </Pressable>
  );
}

function PickerOptions<T extends string | number>({
  options,
  value,
  onPick,
  renderOption,
}: {
  options: PickerOption<T>[];
  value: T;
  onPick: (next: T) => void;
  renderOption: PickerProps<T>['renderOption'];
}) {
  const theme = useTheme();
  const defaultRender = useMemo(
    () =>
      function DefaultRender(
        item: PickerOption<T>,
        isSelected: boolean,
        onPickItem: () => void
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
            onPress={onPickItem}
          />
        );
      },
    [theme.colors.tint]
  );

  if (renderOption !== undefined) {
    return (
      <FlatList
        data={options}
        keyExtractor={(_item, index) => String(index)}
        style={{ maxHeight: 360 }}
        renderItem={({ item }) => {
          const row = renderOption(item, item.value === value, () =>
            onPick(item.value)
          );
          return row ?? <View />;
        }}
      />
    );
  }
  return (
    <List separator>
      {options.map((item, index) => (
        <View key={String(item.value) + String(index)}>
          {defaultRender(item, item.value === value, () => onPick(item.value))}
        </View>
      ))}
    </List>
  );
}
