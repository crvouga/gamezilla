import { buildThumbnailEnumOptions, isEnumRandom } from './option-helpers';
import type { SchemaField } from './dicebear-schema';
import type { StyleKey } from './dicebear-styles';
import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';
import { AvatarPickerThumb } from './avatar-picker-thumb';
import type { AvatarConfig } from '../shared/avatar-config';
import { HorizontalPicker, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { memo, useCallback, useMemo, type ReactNode } from 'react';

export type VariantSwatchStripProps = {
  field: Extract<SchemaField, { kind: 'enum' }>;
  styleKey: StyleKey;
  seed: string;
  /** Current draft options so each swatch mirrors the rest of the form. */
  options: Record<string, unknown>;
  selectedVariant: string | null;
  seedFallback: string;
  onSelect: (variant: string | null) => void;
};

const ITEM = 84;
const THUMB = ITEM - 8;
const RANDOM = '__random__' as const;

type VariantItem = typeof RANDOM | string;

function variantSelectedIndex(
  selectedVariant: string | null,
  values: readonly string[]
): number {
  if (selectedVariant === null) return 0;
  const i = values.indexOf(selectedVariant);
  return i >= 0 ? i + 1 : 0;
}

const VariantThumb = memo(function VariantThumb({
  item,
  styleKey,
  seed,
  options,
  seedFallback,
  fieldKey,
  randomCaption,
}: {
  item: VariantItem;
  styleKey: StyleKey;
  seed: string;
  options: Record<string, unknown>;
  seedFallback: string;
  fieldKey: string;
  randomCaption: string;
}): ReactNode {
  if (item === RANDOM) {
    return (
      <AvatarPickerThumb
        itemWidth={ITEM}
        thumbSize={THUMB}
        caption={randomCaption}
      >
        <Text variant="caption" label={<Trans>?</Trans>} />
      </AvatarPickerThumb>
    );
  }
  const thumbConfig: AvatarConfig = {
    style: styleKey,
    seed,
    options: buildThumbnailEnumOptions(styleKey, fieldKey, item, options),
  };
  return (
    <AvatarPickerThumb
      itemWidth={ITEM}
      thumbSize={THUMB}
      caption={item.replace(/^variant/i, '')}
    >
      <ProfileDiceBearAvatar
        config={thumbConfig}
        fallbackSeed={seedFallback}
        size={THUMB}
      />
    </AvatarPickerThumb>
  );
});

export const VariantSwatchStrip = memo(function VariantSwatchStrip({
  field,
  styleKey,
  seed,
  options,
  selectedVariant,
  seedFallback,
  onSelect,
}: VariantSwatchStripProps) {
  const { t } = useLingui();
  const randomCaption = t`Random`;
  const items: VariantItem[] = useMemo(
    () => [RANDOM, ...field.values],
    [field.values]
  );
  const selectedIndex = variantSelectedIndex(selectedVariant, field.values);
  const optionsJson = JSON.stringify(options);
  const extraData = `${seed}|${optionsJson}`;

  const renderItem = useCallback(
    (item: VariantItem) => (
      <VariantThumb
        item={item}
        styleKey={styleKey}
        seed={seed}
        options={options}
        seedFallback={seedFallback}
        fieldKey={field.key}
        randomCaption={randomCaption}
      />
    ),
    [styleKey, seed, options, seedFallback, field.key, randomCaption]
  );

  return (
    <HorizontalPicker
      items={items}
      selectedIndex={selectedIndex}
      onSelect={(item) => onSelect(item === RANDOM ? null : item)}
      itemWidth={ITEM}
      showArrows={false}
      keyExtractor={(item) => item}
      renderItem={renderItem}
      extraData={extraData}
    />
  );
});

/** Derive selectedVariant for a field from draft options. */
export function selectedVariantForField(
  field: Extract<SchemaField, { kind: 'enum' }>,
  current: unknown
): string | null {
  if (isEnumRandom(field, current)) return null;
  if (
    Array.isArray(current) &&
    current.length === 1 &&
    typeof current[0] === 'string'
  ) {
    return current[0];
  }
  return null;
}
