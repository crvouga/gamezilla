import { Box, Pressable, Text, useTheme } from '@gamezilla/shared/ui';

export type StepperProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
};

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
}: StepperProps) {
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
        <Pressable
          onPressIn={dec}
          disabled={disabled || value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          sx={{
            minWidth: 40,
            alignItems: 'center',
            py: 2,
            opacity: disabled || value <= min ? 0.4 : 1,
          }}
        >
          <Text variant="title" label="−" />
        </Pressable>
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
        <Pressable
          onPressIn={inc}
          disabled={disabled || value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          sx={{
            minWidth: 40,
            alignItems: 'center',
            py: 2,
            opacity: disabled || value >= max ? 0.4 : 1,
          }}
        >
          <Text variant="title" label="+" />
        </Pressable>
      </Box>
    </Box>
  );
}
