/**
 * `ChipGroup` — single-select horizontal row of {@link Chip} options.
 */

import type { ReactNode } from 'react';
import { Box } from '../box';
import { Chip } from '../chip';
import { Text } from '../text';

export type ChipGroupOption<K extends string = string> = {
  key: K;
  label: ReactNode;
  /** Optional leading icon node inside the chip area (caller-sized). */
  icon?: ReactNode;
};

export type ChipGroupProps<K extends string = string> = {
  options: readonly ChipGroupOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** Optional section label above the chips. */
  label?: ReactNode;
  disabled?: boolean;
};

export function ChipGroup<K extends string = string>({
  options,
  selected,
  onSelect,
  label,
  disabled = false,
}: ChipGroupProps<K>) {
  return (
    <Box sx={{ gap: 2, py: 1 }}>
      {label !== undefined ? <Text variant="label" label={label} /> : null}
      <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {options.map((opt) => {
          const isSel = opt.key === selected;
          return (
            <Box
              key={opt.key}
              sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
            >
              {opt.icon !== undefined ? opt.icon : null}
              <Chip
                label={opt.label}
                selected={isSel}
                disabled={disabled}
                onPress={() => onSelect(opt.key)}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
