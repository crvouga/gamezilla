import {
  STYLE_KEYS,
  styleLabel,
  type StyleKey,
} from '@gamezilla/client/features/profile/dicebear-styles';
import { ProfileDiceBearAvatar } from '@gamezilla/client/features/profile/profile-dicebear-avatar';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { HorizontalPicker } from '@gamezilla/lib/ui';

export type StylePickerStripProps = {
  selected: StyleKey;
  seed: string;
  onSelect: (key: StyleKey) => void;
  principalId: string;
};

const ITEM = 60;

export function StylePickerStrip({
  selected,
  seed,
  onSelect,
  principalId,
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
            fallbackSeed={principalId}
            size={ITEM - 12}
          />
        );
      }}
    />
  );
}
