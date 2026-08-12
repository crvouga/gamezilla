/**
 * `MultiSelectSwatchGrid` — multi-select color tokens with optional random
 * preset, transparent swatch, and custom hex entry.
 */

import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';
import { TextInput } from '../text-input';
import { arraysEqualAsSets } from './arrays-equal-as-sets';

const DEFAULT_HEX = /^[0-9a-fA-F]{6}$/;

export type MultiSelectSwatchGridProps = {
  label: ReactNode;
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
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function isSelected(value: string[], token: string): boolean {
  const lower = token.toLowerCase();
  return value.some((v) => v.toLowerCase() === lower);
}

function useUniquePalette(palette: string[]): string[] {
  return useMemo(() => {
    const s = new Set<string>();
    for (const c of palette) s.add(c.toLowerCase());
    return [...s];
  }, [palette]);
}

function useToggleColor(
  value: string[],
  onChange: (next: string[]) => void
): (hex: string) => void {
  return useCallback(
    (hex: string) => {
      const lower = hex.toLowerCase();
      if (value.some((v) => v.toLowerCase() === lower)) {
        onChange(value.filter((v) => v.toLowerCase() !== lower));
      } else {
        onChange([...value, hex]);
      }
    },
    [onChange, value]
  );
}

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
  dataSet,
}: MultiSelectSwatchGridProps) {
  const uniquePalette = useUniquePalette(palette);
  const toggle = useToggleColor(value, onChange);
  const isRandom =
    defaultPalette !== undefined &&
    arraysEqualAsSets(
      value.map((v) => v.toLowerCase()),
      defaultPalette.map((v) => v.toLowerCase())
    );

  return (
    <Box
      sx={{ gap: 2, py: 2 }}
      {...componentDataSet('MultiSelectSwatchGrid', dataSet)}
    >
      <Text variant="label" label={label} />
      <SwatchRow
        uniquePalette={uniquePalette}
        value={value}
        toggle={toggle}
        defaultPalette={defaultPalette}
        isRandom={isRandom}
        onPickRandom={() =>
          defaultPalette !== undefined
            ? onChange([...defaultPalette])
            : undefined
        }
        allowTransparent={allowTransparent}
        transparentToken={transparentToken}
        renderSwatch={renderSwatch}
      />
      {allowCustomEntry ? (
        <CustomHexInput
          value={value}
          onChange={onChange}
          validateCustom={validateCustom}
        />
      ) : null}
    </Box>
  );
}

function SwatchRow({
  uniquePalette,
  value,
  toggle,
  defaultPalette,
  isRandom,
  onPickRandom,
  allowTransparent,
  transparentToken,
  renderSwatch,
}: {
  uniquePalette: string[];
  value: string[];
  toggle: (hex: string) => void;
  defaultPalette: string[] | undefined;
  isRandom: boolean;
  onPickRandom: () => void;
  allowTransparent: boolean;
  transparentToken: string;
  renderSwatch: MultiSelectSwatchGridProps['renderSwatch'];
}) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
      }}
    >
      {defaultPalette !== undefined ? (
        <RandomChip isRandom={isRandom} onPress={onPickRandom} />
      ) : null}
      {allowTransparent ? (
        <SwatchSlot
          hex={transparentToken}
          active={isSelected(value, transparentToken)}
          onPress={() => toggle(transparentToken)}
          transparentToken={transparentToken}
          renderSwatch={renderSwatch}
        />
      ) : null}
      {uniquePalette.map((hex) => (
        <Box key={hex}>
          <SwatchSlot
            hex={hex}
            active={isSelected(value, hex)}
            onPress={() => toggle(hex)}
            transparentToken={transparentToken}
            renderSwatch={renderSwatch}
          />
        </Box>
      ))}
    </Box>
  );
}

function RandomChip({
  isRandom,
  onPress,
}: {
  isRandom: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      sx={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isRandom ? 'tint' : 'border',
        backgroundColor: 'surface',
      }}
    >
      <Text
        variant="caption"
        sx={{
          fontWeight: isRandom ? '600' : '400',
          color: 'text',
        }}
        label="Random"
      />
    </Pressable>
  );
}

function SwatchSlot({
  hex,
  active,
  onPress,
  transparentToken,
  renderSwatch,
}: {
  hex: string;
  active: boolean;
  onPress: () => void;
  transparentToken: string;
  renderSwatch: MultiSelectSwatchGridProps['renderSwatch'];
}) {
  if (renderSwatch !== undefined) {
    return <>{renderSwatch(hex, active, onPress)}</>;
  }
  return (
    <DefaultSwatch
      hex={hex}
      active={active}
      onPress={onPress}
      transparentToken={transparentToken}
    />
  );
}

function DefaultSwatch({
  hex,
  active,
  onPress,
  transparentToken,
}: {
  hex: string;
  active: boolean;
  onPress: () => void;
  transparentToken: string;
}) {
  const theme = useTheme();
  const isTrans = hex.toLowerCase() === transparentToken.toLowerCase();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={isTrans ? 'Transparent' : `Color ${hex}`}
      sx={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: active ? 'tint' : 'border',
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
}

function CustomHexInput({
  value,
  onChange,
  validateCustom,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  validateCustom: (token: string) => boolean;
}) {
  const { t } = useLingui();
  const [hexDraft, setHexDraft] = useState('');
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

  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="caption"
        sx={{ opacity: 0.8 }}
        label={<Trans>Add hex (6 chars, no #)</Trans>}
      />
      <Box sx={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
        <Box sx={{ flex: 1 }}>
          <TextInput
            value={hexDraft}
            onChangeText={setHexDraft}
            placeholder={t`e.g. ff5733`}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={6}
          />
        </Box>
        <Pressable
          onPress={addHex}
          sx={{ paddingVertical: 8, paddingHorizontal: 12 }}
        >
          <Text
            variant="label"
            sx={{ color: 'tint' }}
            label={<Trans>Add</Trans>}
          />
        </Pressable>
      </Box>
    </Box>
  );
}
