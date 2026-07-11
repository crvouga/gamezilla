import { STYLE_KEYS, styleLabel, type StyleKey } from './dicebear-styles';
import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';
import type { AvatarConfig } from '../shared/avatar-config';
import { HorizontalPicker } from '@pkgs/ui';

export type StylePickerStripProps = {
  selected: StyleKey;
  seed: string;
  onSelect: (key: StyleKey) => void;
  seedFallback: string;
  styles?: readonly StyleKey[];
  contentInsetLeading?: number;
  contentInsetTrailing?: number;
};

/** Matches ScreenBase body horizontal padding (spacing step 4). */
const PICKER_INSET = 16;

const ITEM = 84;
const THUMB = ITEM - 8;

export function StylePickerStrip({
  selected,
  seed,
  onSelect,
  seedFallback,
  styles = STYLE_KEYS,
  contentInsetLeading = PICKER_INSET,
  contentInsetTrailing,
}: StylePickerStripProps) {
  return (
    <HorizontalPicker
      items={styles}
      keyFor={(k) => k}
      selectedKey={selected}
      onSelectItem={(k) => onSelect(k)}
      itemWidth={ITEM}
      captionFor={(k) => styleLabel(k)}
      contentInsetLeading={contentInsetLeading}
      {...(contentInsetTrailing !== undefined ? { contentInsetTrailing } : {})}
      renderPreview={(item) => {
        const preview: AvatarConfig = {
          style: item,
          seed,
          options: {},
        };
        return (
          <ProfileDiceBearAvatar
            config={preview}
            fallbackSeed={seedFallback}
            size={THUMB}
          />
        );
      }}
    />
  );
}

export { STYLE_KEYS };
