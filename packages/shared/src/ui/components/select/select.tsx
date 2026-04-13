/**
 * `Select` -- modal-based picker for choosing from a list of options.
 *
 * Since React Native has no native `<select>`, this renders a pressable
 * trigger that opens a modal option list on press.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Latency"
 *   options={[{ label: '0 ms', value: 0 }, { label: '100 ms', value: 100 }]}
 *   value={latency}
 *   onValueChange={setLatency}
 * />
 * ```
 */

import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';
import { ModalRoot } from '../modal/modal-root';
import { ModalBackdrop } from '../modal/modal-backdrop';
import { ModalContent } from '../modal/modal-content';

export type SelectOption<T extends string | number = string> = {
  label: string;
  value: T;
};

export type SelectProps<T extends string | number = string> = {
  options: SelectOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Optional label rendered above the trigger. */
  label?: string;
  disabled?: boolean;
  /** Placeholder when no value matches an option. */
  placeholder?: string;
};

export function Select<T extends string | number = string>({
  options,
  value,
  onValueChange,
  label,
  disabled = false,
  placeholder = 'Select…',
}: SelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

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
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
          pressed && { opacity: 0.7 },
          disabled && { opacity: 0.4 },
        ]}
      >
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

      <ModalRoot visible={open} onRequestClose={() => setOpen(false)}>
        <ModalBackdrop onPress={() => setOpen(false)}>
          <ModalContent style={{ width: 280 }}>
            {label !== undefined && (
              <Text variant="subtitle" sx={{ mb: 2 }} label={label} />
            )}
            <FlatList
              data={options}
              keyExtractor={(_item, index) => String(index)}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 8,
                        backgroundColor: isSelected
                          ? theme.colors.tintMuted
                          : 'transparent',
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        variant="label"
                        style={{
                          flex: 1,
                          color: isSelected ? theme.colors.tint : theme.colors.text,
                          fontWeight: isSelected ? '600' : '400',
                        }}
                        label={item.label}
                      />
                      {isSelected && (
                        <Text
                          style={{ color: theme.colors.tint, fontSize: 16 }}
                          label="✓"
                        />
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          </ModalContent>
        </ModalBackdrop>
      </ModalRoot>
    </>
  );
}
