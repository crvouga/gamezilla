/**
 * `NumberStepper` — labeled numeric value with decrement / increment controls.
 */

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type NumberStepperProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  dataSet,
}: NumberStepperProps) {
  const theme = useTheme();
  const dec = () => {
    const next = Math.max(min, value - step);
    if (next !== value) onChange(next);
  };
  const inc = () => {
    const next = Math.min(max, value + step);
    if (next !== value) onChange(next);
  };
  return (
    <Box
      {...componentDataSet('NumberStepper', dataSet)}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        py: 1,
      }}
    >
      <Text variant="label" sx={{ flex: 1 }} label={label} />
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <StepperButton
          onPress={dec}
          disabled={disabled || value <= min}
          accessibilityLabel={`Decrease ${label}`}
          glyph="−"
        />
        <Text
          variant="body"
          style={{
            fontVariant: ['tabular-nums'],
            minWidth: 48,
            textAlign: 'center',
            color: theme.colors.text,
          }}
          label={String(value)}
        />
        <StepperButton
          onPress={inc}
          disabled={disabled || value >= max}
          accessibilityLabel={`Increase ${label}`}
          glyph="+"
        />
      </Box>
    </Box>
  );
}

function StepperButton({
  onPress,
  disabled,
  accessibilityLabel,
  glyph,
}: {
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  glyph: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      sx={{
        minWidth: 40,
        alignItems: 'center',
        py: 2,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text variant="title" label={glyph} />
    </Pressable>
  );
}
