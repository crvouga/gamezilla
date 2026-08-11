import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Chip } from '../chip';
import { Pressable } from '../pressable';
import { Text } from '../text';
import type { ComboboxOption } from './combobox-types';

export function ComboboxLabel({ label }: { label: ReactNode }) {
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

function ComboboxMultiSummary<T extends string | number>({
  selected,
  placeholder,
  onRemove,
}: {
  selected: ComboboxOption<T>[];
  placeholder: LocalizedString;
  onRemove: (value: T) => void;
}) {
  const theme = useTheme();
  if (selected.length === 0) {
    return (
      <Text
        variant="label"
        style={{ flex: 1, color: theme.colors.textSecondary }}
        label={placeholder}
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {selected.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          selected
          onPress={() => onRemove(option.value)}
        />
      ))}
    </View>
  );
}

function webAriaProps(args: {
  open: boolean;
  listboxId: string;
  multiple: boolean;
}): Record<string, unknown> {
  if (Platform.OS !== 'web') return {};
  return {
    'aria-expanded': args.open,
    'aria-controls': args.listboxId,
    'aria-haspopup': 'listbox',
    ...(args.multiple ? { 'aria-multiselectable': true } : {}),
  };
}

export function ComboboxTrigger<T extends string | number>({
  selected,
  selectedOptions,
  multiple,
  placeholder,
  disabled,
  open,
  listboxId,
  onPress,
  onClear,
  onRemove,
}: {
  selected: ComboboxOption<T> | undefined;
  selectedOptions: ComboboxOption<T>[];
  multiple: boolean;
  placeholder: LocalizedString;
  disabled: boolean;
  open: boolean;
  listboxId: string;
  onPress: () => void;
  onClear: (() => void) | undefined;
  onRemove: (value: T) => void;
}) {
  const theme = useTheme();
  const showClear =
    onClear !== undefined &&
    (multiple ? selectedOptions.length > 0 : selected !== undefined);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="combobox"
      accessibilityState={{ disabled, expanded: open }}
      {...webAriaProps({ open, listboxId, multiple })}
      sx={{ borderRadius: borderRadius.md }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.outline,
        backgroundColor: theme.colors.surfaceMuted,
        gap: 10,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {multiple ? (
        <ComboboxMultiSummary
          selected={selectedOptions}
          placeholder={placeholder}
          onRemove={onRemove}
        />
      ) : (
        <>
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
        </>
      )}
      {showClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear"
          style={{ paddingHorizontal: 4, paddingVertical: 2 }}
        >
          <Text
            style={{ color: theme.colors.textSecondary, fontSize: 14 }}
            label="✕"
          />
        </Pressable>
      ) : null}
      <Text
        style={{ color: theme.colors.textSecondary, fontSize: 10 }}
        label="▼"
      />
    </Pressable>
  );
}
