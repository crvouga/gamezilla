import { buildThumbnailEnumOptions, isEnumRandom } from '@/features/profile/avatar-editor/option-helpers';
import { ProfileDiceBearAvatar } from '@/features/profile/profile-dicebear-avatar';
import type { SchemaField } from '@/features/profile/dicebear-schema';
import type { StyleKey } from '@/features/profile/dicebear-styles';
import { Box, FlatList, Pressable, Text, useTheme } from '@gamezilla/shared/ui';
import type { AvatarConfig } from '@gamezilla/shared/profile/avatar-config';
import { useCallback, useMemo } from 'react';

export type VariantSwatchStripProps = {
  field: Extract<SchemaField, { kind: 'enum' }>;
  styleKey: StyleKey;
  draft: AvatarConfig;
  principalId: string;
  onSelect: (variant: string | null) => void;
};

const THUMB = 56;

type Row = { kind: 'random' } | { kind: 'variant'; value: string };

export function VariantSwatchStrip({
  field,
  styleKey,
  draft,
  principalId,
  onSelect,
}: VariantSwatchStripProps) {
  const theme = useTheme();
  const current = draft.options[field.key];
  const randomSelected = isEnumRandom(field, current);

  const rows: Row[] = useMemo(
    () => [{ kind: 'random' }, ...field.values.map((value) => ({ kind: 'variant' as const, value }))],
    [field.values],
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'random') {
        return (
          <Pressable
            onPress={() => onSelect(null)}
            sx={{
              width: THUMB + 8,
              alignItems: 'center',
              gap: 1,
              padding: 1,
            }}
          >
            <Box
              sx={{
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                borderWidth: 2,
                borderColor: randomSelected ? theme.colors.tint : theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text variant="caption" label="?" />
            </Box>
            <Text variant="caption" sx={{ fontSize: 10 }} label="Random" />
          </Pressable>
        );
      }
      const v = item.value;
      const thumbConfig: AvatarConfig = {
        style: styleKey,
        seed: draft.seed,
        options: buildThumbnailEnumOptions(styleKey, field.key, v, draft.options),
      };
      const isActive =
        !randomSelected &&
        Array.isArray(current) &&
        current.length === 1 &&
        current[0] === v;

      return (
        <Pressable
          onPress={() => onSelect(v)}
          sx={{
            width: THUMB + 8,
            alignItems: 'center',
            gap: 1,
            padding: 1,
          }}
        >
          <Box
            sx={{
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              borderWidth: 2,
              borderColor: isActive ? theme.colors.tint : theme.colors.border,
              overflow: 'hidden',
            }}
          >
            <ProfileDiceBearAvatar
              config={thumbConfig}
              fallbackSeed={principalId}
              size={THUMB}
            />
          </Box>
          <Text
            variant="caption"
            sx={{ fontSize: 9, opacity: 0.85 }}
            label={v.replace(/^variant/i, '')}
          />
        </Pressable>
      );
    },
    [
      current,
      draft.options,
      draft.seed,
      field,
      onSelect,
      randomSelected,
      principalId,
      styleKey,
      theme.colors.border,
      theme.colors.surface,
      theme.colors.tint,
    ],
  );

  return (
    <FlatList
      horizontal
      data={rows}
      keyExtractor={(item, i) =>
        item.kind === 'random' ? 'random' : `v-${item.value}-${i}`
      }
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
    />
  );
}
