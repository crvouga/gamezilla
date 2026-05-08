import {
  STYLE_KEYS,
  styleLabel,
  type StyleKey,
} from '@gamezilla/client/profile/dicebear-styles';
import { ProfileDiceBearAvatar } from '@gamezilla/client/profile/profile-dicebear-avatar';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { HorizontalPicker } from '@gamezilla/lib/ui';

export type StylePickerStripProps = {
  selected: StyleKey;
  seed: string;
  onSelect: (key: StyleKey) => void;
  seedFallback: string;
};

const ITEM = 60;

export function StylePickerStrip({
  selected,
  seed,
  onSelect,
  seedFallback,
}: StylePickerStripProps) {
  return (
    <HorizontalPicker
      items={STYLE_KEYS}
      keyFor={(k) => k}
      selectedKey={selected}
      onSelectItem={(k) => onSelect(k)}
      itemWidth={ITEM}
      captionFor={(k) => styleLabel(k)}
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
            size={ITEM - 12}
          />
        );
      }}
    />
  );
}
