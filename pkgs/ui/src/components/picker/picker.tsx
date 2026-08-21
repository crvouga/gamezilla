/**
 * `Picker` — trigger row that opens a {@link ResponsiveSurface} with a
 * scrollable option list (single select).
 *
 * Pass `loading` / `error` for async option lists — status renders inside the
 * open surface; the trigger stays pressable unless `disabled` is set.
 */

import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { borderRadius } from '../../theme/scale';
import type { SxProps } from '../../theme/sx-props';
import { Box } from '../box';
import { ErrorState } from '../error-state';
import { FlatList } from '../flat-list';
import { List, ListItem } from '../list';
import { LoadingState } from '../loading-state';
import { Pressable } from '../pressable';
import { ResponsiveSurface } from '../responsive-surface';
import { Text } from '../text';

export type PickerSize = 'sm' | 'md';

export type PickerOption<T extends string | number = string> = {
  label: ReactNode;
  value: T;
  preview?: ReactNode;
  /** Grayed out; not selectable. */
  disabled?: boolean;
};

export type PickerProps<T extends string | number = string> = {
  options: PickerOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Optional label above the trigger. */
  label?: ReactNode;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: ReactNode;
  /** Content rendered at the top of the surface body (below the title). */
  surfaceExtra?: ReactNode;
  disabled?: boolean;
  /**
   * When true, the open surface shows a spinner instead of options.
   * Does not disable the trigger.
   */
  loading?: boolean;
  /**
   * When set (and not loading), the open surface shows a compact error above
   * the option list. Does not disable the trigger.
   */
  error?: ReactNode;
  placeholder?: LocalizedString;
  /** Compact trigger for dense chrome (e.g. tab bars). Default `'md'`. */
  size?: PickerSize;
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
  surfaceExtra,
  disabled = false,
  loading = false,
  error,
  placeholder,
  size = 'md',
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
        size={size}
        onPress={() => setOpen(true)}
      />
      <ResponsiveSurface
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
      >
        {surfaceExtra !== undefined && surfaceExtra !== null ? (
          <Box sx={{ mb: 2 }}>{surfaceExtra}</Box>
        ) : null}
        <PickerSurfaceBody
          loading={loading}
          error={error}
          options={options}
          value={value}
          onPick={handlePick}
          renderOption={renderOption}
        />
      </ResponsiveSurface>
    </Box>
  );
}

function PickerSurfaceBody<T extends string | number>({
  loading,
  error,
  options,
  value,
  onPick,
  renderOption,
}: {
  loading: boolean;
  error: ReactNode | undefined;
  options: PickerOption<T>[];
  value: T;
  onPick: (next: T) => void;
  renderOption: PickerProps<T>['renderOption'];
}) {
  const { t } = useLingui();
  if (loading) {
    return <LoadingState size="small" />;
  }
  return (
    <Box sx={{ gap: 2 }}>
      {error != null && error !== '' ? (
        <ErrorState variant="compact" title={t`Failed to load`} body={error} />
      ) : null}
      <PickerOptions
        options={options}
        value={value}
        onPick={onPick}
        renderOption={renderOption}
      />
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
  size,
  onPress,
}: {
  selected: PickerOption<T> | undefined;
  placeholder: LocalizedString;
  disabled: boolean;
  size: PickerSize;
  onPress: () => void;
}) {
  const compact = size === 'sm';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      sx={{
        ...triggerSx(compact),
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {selected?.preview !== undefined ? (
        <Box sx={{ flexShrink: 0 }}>{selected.preview}</Box>
      ) : null}
      <Text
        variant={compact ? 'caption' : 'label'}
        numberOfLines={1}
        ellipsizeMode="tail"
        sx={{
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
          color: selected !== undefined ? 'text' : 'textSecondary',
          ...(compact
            ? { fontSize: 12, lineHeight: 16, fontWeight: '500' }
            : {}),
        }}
        label={selected?.label ?? placeholder}
      />
      <Text
        sx={{
          color: 'textSecondary',
          fontSize: compact ? 9 : 10,
          flexShrink: 0,
        }}
        label="▼"
      />
    </Pressable>
  );
}

function triggerSx(compact: boolean): SxProps {
  return {
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    ...(compact ? { height: 32 } : {}),
    paddingHorizontal: compact ? 8 : 12,
    paddingVertical: compact ? 0 : 10,
    borderWidth: 1,
    borderColor: 'outline',
    backgroundColor: 'surfaceMuted',
    gap: compact ? 1.5 : 2.5,
  };
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
        const disabled = item.disabled === true;
        return (
          <Box sx={{ opacity: disabled ? 0.4 : 1 }}>
            <ListItem
              title={item.label}
              leading={item.preview}
              trailing={
                isSelected ? (
                  <Text sx={{ color: 'tint', fontSize: 16 }} label="✓" />
                ) : undefined
              }
              {...(disabled ? {} : { onPress: onPickItem })}
            />
          </Box>
        );
      },
    []
  );

  const pickIfEnabled = (item: PickerOption<T>) => {
    if (item.disabled === true) return;
    onPick(item.value);
  };

  if (renderOption !== undefined) {
    return (
      <FlatList
        data={options}
        extraData={value}
        keyExtractor={(item) => String(item.value)}
        frameSx={{ maxHeight: 360 }}
        renderItem={({ item }) => {
          const row = renderOption(item, item.value === value, () =>
            pickIfEnabled(item)
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
          {defaultRender(item, item.value === value, () => pickIfEnabled(item))}
        </Box>
      ))}
    </List>
  );
}
