/**
 * `Picker` — trigger row that opens a {@link ResponsiveSurface} with a
 * scrollable option list (single select).
 */

import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { FlatList } from '../flat-list';
import { List, ListItem } from '../list';
import { Pressable } from '../pressable';
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
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
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
  dataSet,
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
    <Box {...componentDataSet('Picker', dataSet)}>
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
    </Box>
  );
}

function PickerLabel({ label }: { label: ReactNode }) {
  return (
    <Text
      variant="caption"
      sx={{ mb: 0.5, color: 'textSecondary' }}
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      sx={{
        borderRadius: borderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'outline',
        backgroundColor: 'surfaceMuted',
        gap: 2.5,
        opacity: disabled ? 0.4 : 1,
      }}
    >
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
      <Text sx={{ color: 'textSecondary', fontSize: 10 }} label="▼" />
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
                <Text sx={{ color: 'tint', fontSize: 16 }} label="✓" />
              ) : undefined
            }
            onPress={onPickItem}
          />
        );
      },
    []
  );

  if (renderOption !== undefined) {
    return (
      <FlatList
        data={options}
        keyExtractor={(_item, index) => String(index)}
        frameSx={{ maxHeight: 360 }}
        renderItem={({ item }) => {
          const row = renderOption(item, item.value === value, () =>
            onPick(item.value)
          );
          return row ?? <Box />;
        }}
      />
    );
  }
  return (
    <List separator>
      {options.map((item, index) => (
        <Box key={String(item.value) + String(index)}>
          {defaultRender(item, item.value === value, () => onPick(item.value))}
        </Box>
      ))}
    </List>
  );
}
