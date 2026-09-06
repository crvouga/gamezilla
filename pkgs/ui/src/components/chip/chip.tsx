/**
 * `Chip` -- compact tag / filter element.
 *
 * Flat surface chip with a hairline border in both states:
 *   - Unselected reads as a quiet pill (`surface` fill + `border` outline +
 *     `text` foreground).
 *   - Selected lifts the brand color (`tintHighlight` fill + `tint` border +
 *     `tint` foreground) without feeling shouty next to its peers.
 *
 * Hover/press is delegated to {@link Pressable}'s tint overlay so the
 * interaction language matches every other pressable in the system.
 *
 * @example
 * ```tsx
 * <Chip label="React Native" selected={sel} onPress={() => setSel(!sel)} />
 * <Chip label="With icon" startIcon={<PlusIcon size={16} />} />
 * ```
 */

import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type ChipProps = {
  label: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Rendered before the label (sized to match the chip text). */
  startIcon?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/** Fixed pill height so every chip in a row shares one baseline. */
export const CHIP_HEIGHT = 32;
/** Short labels ("All") stay pill-shaped instead of collapsing to a circle. */
const CHIP_MIN_WIDTH = 56;
const CHIP_ICON_SIZE = 16;

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  startIcon,
  dataSet,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      dataSet={{ component: 'Chip', ...dataSet }}
      sx={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        px: 3,
        height: CHIP_HEIGHT,
        minWidth: CHIP_MIN_WIDTH,
        borderRadius: 'full',
        borderWidth: 1,
        borderColor: selected ? 'tint' : 'border',
        backgroundColor: selected ? 'tintHighlight' : 'surface',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {startIcon !== undefined ? (
        <Box
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
            height: CHIP_ICON_SIZE,
          }}
        >
          {startIcon}
        </Box>
      ) : null}
      <Text
        variant="label"
        numberOfLines={1}
        sx={{
          color: selected ? 'tint' : 'text',
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
        }}
        label={label}
      />
    </Pressable>
  );
}
