import { arraysEqualAsSets } from '@/features/profile/avatar-editor/option-helpers';
import {
  Box,
  Pressable,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/shared/ui';
import { useCallback, useMemo, useState } from 'react';

const HEX = /^[0-9a-fA-F]{6}$/;

export type ColorSwatchGridProps = {
  label: string;
  palette: string[];
  value: string[];
  onChange: (next: string[]) => void;
  allowTransparent: boolean;
  defaultPalette: string[];
};

export function ColorSwatchGrid({
  label,
  palette,
  value,
  onChange,
  allowTransparent,
  defaultPalette,
}: ColorSwatchGridProps) {
  const theme = useTheme();
  const [hexDraft, setHexDraft] = useState('');

  const uniquePalette = useMemo(() => {
    const s = new Set<string>();
    for (const c of palette) s.add(c.toLowerCase());
    return [...s];
  }, [palette]);

  const toggle = useCallback(
    (hex: string) => {
      const lower = hex.toLowerCase();
      const cur = value.map((v) => v.toLowerCase());
      if (cur.includes(lower)) {
        onChange(value.filter((v) => v.toLowerCase() !== lower));
      } else {
        onChange([...value, hex]);
      }
    },
    [onChange, value]
  );

  const addHex = useCallback(() => {
    const t = hexDraft.trim();
    if (!HEX.test(t)) return;
    const normalized = t.toLowerCase();
    if (value.some((v) => v.toLowerCase() === normalized)) {
      setHexDraft('');
      return;
    }
    onChange([...value, normalized]);
    setHexDraft('');
  }, [hexDraft, onChange, value]);

  const isRandom = arraysEqualAsSets(
    value.map((v) => v.toLowerCase()),
    defaultPalette.map((v) => v.toLowerCase())
  );

  return (
    <Box sx={{ gap: 2, py: 2 }}>
      <Text variant="label" label={label} />
      <Box
        sx={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Pressable
          onPressIn={() => onChange([...defaultPalette])}
          sx={{
            paddingHorizontal: 3,
            paddingVertical: 2,
            borderRadius: 2,
            borderWidth: 1,
            borderColor: isRandom ? theme.colors.tint : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text
            variant="caption"
            sx={{
              fontWeight: isRandom ? '600' : '400',
              color: theme.colors.text,
            }}
            label="Random"
          />
        </Pressable>
        {allowTransparent ? (
          <Pressable
            onPressIn={() => toggle('transparent')}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: value.some((v) => v.toLowerCase() === 'transparent')
                ? theme.colors.tint
                : theme.colors.border,
              backgroundColor: 'transparent',
              overflow: 'hidden',
            }}
            accessibilityLabel="Transparent"
          >
            <Box
              sx={{
                flex: 1,
                backgroundColor: theme.colors.border,
                opacity: 0.35,
              }}
            />
          </Pressable>
        ) : null}
        {uniquePalette.map((hex) => {
          const active = value.some(
            (v) => v.toLowerCase() === hex.toLowerCase()
          );
          return (
            <Pressable
              key={hex}
              onPressIn={() => toggle(hex)}
              accessibilityLabel={`Color ${hex}`}
              sx={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: active ? theme.colors.tint : theme.colors.border,
                backgroundColor: `#${hex}`,
              }}
            />
          );
        })}
      </Box>
      <Box sx={{ gap: 1 }}>
        <Text
          variant="caption"
          sx={{ opacity: 0.8 }}
          label="Add hex (6 chars, no #)"
        />
        <Box sx={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <TextInput
              value={hexDraft}
              onChangeText={setHexDraft}
              placeholder="e.g. ff5733"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={6}
            />
          </Box>
          <Pressable
            onPressIn={addHex}
            sx={{ paddingVertical: 2, paddingHorizontal: 3 }}
          >
            <Text
              variant="label"
              sx={{ color: theme.colors.tint }}
              label="Add"
            />
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
}
