import { Box, Pressable, Text, useTheme } from '@gamezilla/shared/ui';

export type ProbabilityMode = 'off' | 'random' | 'always';

export type ProbabilityChipGroupProps = {
  label: string;
  mode: ProbabilityMode;
  onChange: (mode: ProbabilityMode) => void;
  disabled?: boolean;
};

export function ProbabilityChipGroup({
  label,
  mode,
  onChange,
  disabled = false,
}: ProbabilityChipGroupProps) {
  const theme = useTheme();
  const chips: { key: ProbabilityMode; title: string }[] = [
    { key: 'off', title: 'Off' },
    { key: 'random', title: 'Random' },
    { key: 'always', title: 'Always' },
  ];
  return (
    <Box sx={{ gap: 2, py: 1 }}>
      <Text variant="label" label={label} />
      <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {chips.map(({ key, title }) => {
          const active = mode === key;
          return (
            <Pressable
              key={key}
              disabled={disabled}
              onPress={() => onChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              sx={{
                paddingHorizontal: 3,
                paddingVertical: 2,
                borderRadius: 2,
                backgroundColor: active
                  ? theme.colors.tint
                  : theme.colors.surface,
                borderWidth: 1,
                borderColor: active ? theme.colors.tint : theme.colors.border,
              }}
            >
              <Text
                variant="caption"
                sx={{
                  color: active ? theme.colors.surface : theme.colors.text,
                  fontWeight: active ? '600' : '400',
                }}
                label={title}
              />
            </Pressable>
          );
        })}
      </Box>
    </Box>
  );
}
