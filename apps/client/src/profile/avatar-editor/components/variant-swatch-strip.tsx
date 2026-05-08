import {
  buildThumbnailEnumOptions,
  isEnumRandom,
} from '@gamezilla/client/profile/avatar-editor/option-helpers';
import type { SchemaField } from '@gamezilla/client/profile/avatar-editor/dicebear-schema';
import type { StyleKey } from '@gamezilla/client/profile/avatar-editor/dicebear-styles';
import { ProfileDiceBearAvatar } from '@gamezilla/client/profile/avatar-editor/profile-dicebear-avatar';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { HorizontalPicker, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

export type VariantSwatchStripProps = {
  field: Extract<SchemaField, { kind: 'enum' }>;
  styleKey: StyleKey;
  draft: AvatarConfig;
  seedFallback: string;
  onSelect: (variant: string | null) => void;
};

const ITEM = 64;

export function VariantSwatchStrip({
  field,
  styleKey,
  draft,
  seedFallback,
  onSelect,
}: VariantSwatchStripProps) {
  const current = draft.options[field.key];
  const randomSelected = isEnumRandom(field, current);

  const selectedKey =
    !randomSelected &&
    Array.isArray(current) &&
    current.length === 1 &&
    typeof current[0] === 'string'
      ? (current[0] as string)
      : null;

  return (
    <HorizontalPicker
      items={field.values}
      keyFor={(v) => v}
      selectedKey={selectedKey}
      onSelectItem={(v) => onSelect(v)}
      itemWidth={ITEM}
      captionFor={(v) => v.replace(/^variant/i, '')}
      randomItem={{
        selected: randomSelected,
        onSelect: () => onSelect(null),
        render: () => <Text variant="caption" label={<Trans>?</Trans>} />,
      }}
      renderPreview={(v) => {
        const thumbConfig: AvatarConfig = {
          style: styleKey,
          seed: draft.seed,
          options: buildThumbnailEnumOptions(
            styleKey,
            field.key,
            v,
            draft.options
          ),
        };
        return (
          <ProfileDiceBearAvatar
            config={thumbConfig}
            fallbackSeed={seedFallback}
            size={ITEM - 12}
          />
        );
      }}
    />
  );
}
