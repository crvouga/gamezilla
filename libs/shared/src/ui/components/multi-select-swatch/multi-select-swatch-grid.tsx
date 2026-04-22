/**
 * `MultiSelectSwatchGrid` — multi-select color tokens with optional random
 * preset, transparent swatch, and custom hex entry.
 */

import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Text } from '../text';
import { TextInput } from '../text-input';
import { arraysEqualAsSets } from './arrays-equal-as-sets';

const DEFAULT_HEX = /^[0-9a-fA-F]{6}$/;

export type MultiSelectSwatchGridProps = {
  label: string;
  palette: string[];
  value: string[];
  onChange: (next: string[]) => void;
  allowTransparent?: boolean;
  /** When current `value` matches this multiset (case-insensitive), “Random” is highlighted. */
  defaultPalette?: string[];
  allowCustomEntry?: boolean;
  validateCustom?: (token: string) => boolean;
  /** Token stored in `value` for the transparent swatch. */
  transparentToken?: string;
  renderSwatch?: (
    colorToken: string,
    active: boolean,
    onPress: () => void
  ) => ReactNode;
};

export function MultiSelectSwatchGrid({
  label,
  palette,
  value,
  onChange,
  allowTransparent = false,
  defaultPalette,
  allowCustomEntry = true,
  validateCustom = (s) => DEFAULT_HEX.test(s),
  transparentToken = 'transparent',
  renderSwatch,
}: MultiSelectSwatchGridProps) {
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
    const t = hexDraft.trim().toLowerCase();
    if (!validateCustom(t)) return;
    if (value.some((v) => v.toLowerCase() === t)) {
      setHexDraft('');
      return;
    }
    onChange([...value, t]);
    setHexDraft('');
  }, [hexDraft, onChange, value, validateCustom]);

  const isRandom =
    defaultPalette !== undefined &&
    arraysEqualAsSets(
      value.map((v) => v.toLowerCase()),
      defaultPalette.map((v) => v.toLowerCase())
    );

  const defaultSwatch = useCallback(
    (hex: string, active: boolean, onPress: () => void) => {
      const lower = hex.toLowerCase();
      const isTrans = lower === transparentToken.toLowerCase();
      return (
        <Pressable
          key={hex}
          onPress={onPress}
          accessibilityLabel={isTrans ? 'Transparent' : `Color ${hex}`}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: active ? theme.colors.tint : theme.colors.border,
            backgroundColor: isTrans ? 'transparent' : `#${hex}`,
            overflow: 'hidden',
          }}
        >
          {isTrans ? (
            <Box
              sx={{
                flex: 1,
                backgroundColor: theme.colors.border,
                opacity: 0.35,
              }}
            />
          ) : null}
        </Pressable>
      );
    },
    [theme.colors.border, theme.colors.tint, transparentToken]
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
        {defaultPalette !== undefined ? (
          <Pressable
            onPress={() => onChange([...defaultPalette])}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isRandom ? theme.colors.tint : theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text
              variant="caption"
              style={{
                fontWeight: isRandom ? '600' : '400',
                color: theme.colors.text,
              }}
              label="Random"
            />
          </Pressable>
        ) : null}
        {allowTransparent ? (
          renderSwatch !== undefined ? (
            renderSwatch(
              transparentToken,
              value.some((v) => v.toLowerCase() === transparentToken.toLowerCase()),
              () => toggle(transparentToken)
            )
          ) : (
            defaultSwatch(
              transparentToken,
              value.some((v) => v.toLowerCase() === transparentToken.toLowerCase()),
              () => toggle(transparentToken)
            )
          )
        ) : null}
        {uniquePalette.map((hex) => {
          const active = value.some((v) => v.toLowerCase() === hex.toLowerCase());
          const onPress = () => toggle(hex);
          return renderSwatch !== undefined ? (
            <Box key={hex}>{renderSwatch(hex, active, onPress)}</Box>
          ) : (
            <Box key={hex}>{defaultSwatch(hex, active, onPress)}</Box>
          );
        })}
      </Box>
      {allowCustomEntry ? (
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
              onPress={addHex}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text
                variant="label"
                style={{ color: theme.colors.tint }}
                label="Add"
              />
            </Pressable>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
