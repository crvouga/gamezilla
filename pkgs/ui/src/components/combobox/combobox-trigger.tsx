import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
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

export function ComboboxTrigger<T extends string | number>({
  selected,
  placeholder,
  disabled,
  onPress,
}: {
  selected: ComboboxOption<T> | undefined;
  placeholder: LocalizedString;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
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
