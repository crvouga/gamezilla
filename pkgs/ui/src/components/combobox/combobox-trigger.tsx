import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { Chip } from '../chip';
import { Pressable } from '../pressable';
import { Text } from '../text';
import type { ComboboxOption } from './combobox-types';

export function ComboboxLabel({ label }: { label: ReactNode }) {
  return (
    <Text
      variant="caption"
      sx={{ mb: 0.5, color: 'textSecondary' }}
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
  if (selected.length === 0) {
    return (
      <Text
        variant="label"
        sx={{ flex: 1, color: 'textSecondary' }}
        label={placeholder}
      />
    );
  }
  return (
    <Box
      sx={{
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 1.5,
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
    </Box>
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
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'outline',
        background: 'surfaceMuted',
        gap: 2.5,
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
            <Box sx={{ flexShrink: 0 }}>{selected.preview}</Box>
          ) : null}
          <Text
            variant="label"
            sx={{
              flex: 1,
              color: selected !== undefined ? 'text' : 'textSecondary',
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
          sx={{ paddingHorizontal: 4, paddingVertical: 2 }}
        >
          <Text sx={{ color: 'textSecondary', fontSize: 14 }} label="✕" />
        </Pressable>
      ) : null}
      <Text sx={{ color: 'textSecondary', fontSize: 10 }} label="▼" />
    </Pressable>
  );
}
