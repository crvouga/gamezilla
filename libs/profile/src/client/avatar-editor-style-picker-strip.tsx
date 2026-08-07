import { HorizontalPicker } from '@pkgs/ui';
import { memo, type ReactNode, useCallback } from 'react';
import type { AvatarConfig } from '../shared/avatar-config';
import { AvatarPickerThumb } from './avatar-picker-thumb';
import { STYLE_KEYS, type StyleKey, styleLabel } from './dicebear-styles';
import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';

export type StylePickerStripProps = {
  selected: StyleKey;
  seed: string;
  onSelect: (key: StyleKey) => void;
  onSettle: (key: StyleKey) => void;
  seedFallback: string;
  styles?: readonly StyleKey[];
};

const ITEM = 84;
const THUMB = ITEM - 8;

const StyleThumb = memo(function StyleThumb({
  item,
  seed,
  seedFallback,
}: {
  item: StyleKey;
  seed: string;
  seedFallback: string;
}): ReactNode {
  const preview: AvatarConfig = {
    style: item,
    seed,
    options: {},
  };
  return (
    <AvatarPickerThumb
      itemWidth={ITEM}
      thumbSize={THUMB}
      caption={styleLabel(item)}
    >
      <ProfileDiceBearAvatar
        config={preview}
        fallbackSeed={seedFallback}
        size={THUMB}
      />
    </AvatarPickerThumb>
  );
});

export function StylePickerStrip({
  selected,
  seed,
  onSelect,
  onSettle,
  seedFallback,
  styles = STYLE_KEYS,
}: StylePickerStripProps) {
  const selectedIndex = Math.max(
    0,
    styles.findIndex((k) => k === selected)
  );

  const renderItem = useCallback(
    (item: StyleKey) => (
      <StyleThumb item={item} seed={seed} seedFallback={seedFallback} />
    ),
    [seed, seedFallback]
  );

  return (
    <HorizontalPicker
      items={styles}
      selectedIndex={selectedIndex}
      onSelect={(k) => onSelect(k)}
      onSettle={(k) => onSettle(k)}
      itemWidth={ITEM}
      showArrows={false}
      keyExtractor={(k) => k}
      renderItem={renderItem}
      extraData={seed}
    />
  );
}

export { STYLE_KEYS };
