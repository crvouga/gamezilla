/**
 * `Checkbox` -- a simple check toggle built with Pressable.
 *
 * Checked state fills the box with `tint` and renders a real SVG checkmark
 * stroked in `onPrimary` so the contrast holds in both schemes. Hover /
 * press feedback comes from {@link Pressable}'s tint overlay.
 *
 * @example
 * ```tsx
 * <Checkbox label="Accept terms" checked={accepted} onToggle={setAccepted} />
 * ```
 */

import type { ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';
import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type CheckboxProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const BOX_SIZE = 18;

export function Checkbox({
  checked,
  onToggle,
  label,
  disabled = false,
  dataSet,
}: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => !disabled && onToggle(!checked)}
      disabled={disabled}
      dataSet={{ component: 'Checkbox', ...dataSet }}
      sx={{
        borderRadius: 'xs',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Box
        sx={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          borderRadius: 'xs',
          borderWidth: 1.5,
          borderColor: checked ? 'tint' : 'outline',
          backgroundColor: checked ? 'tint' : 'surface',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Svg width={BOX_SIZE - 4} height={BOX_SIZE - 4} viewBox="0 0 16 16">
            <Path
              d="M3.5 8.5 L7 12 L13 4.5"
              fill="none"
              stroke={theme.colors.onPrimary}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </Box>
      {label && <Text variant="body" label={label} />}
    </Pressable>
  );
}
