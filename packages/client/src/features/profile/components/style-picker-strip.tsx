import {
  STYLE_KEYS,
  styleLabel,
  type StyleKey,
} from '@/features/profile/dicebear-styles';
import { ProfileDiceBearAvatar } from '@/features/profile/profile-dicebear-avatar';
import type { AvatarConfig } from '@gamezilla/shared/profile/avatar-config';
import { Box, FlatList, Pressable, Text, useTheme } from '@gamezilla/shared/ui';

export type StylePickerStripProps = {
  selected: StyleKey;
  seed: string;
  onSelect: (key: StyleKey) => void;
  principalId: string;
};

const PREVIEW = 48;

export function StylePickerStrip({
  selected,
  seed,
  onSelect,
  principalId,
}: StylePickerStripProps) {
  const theme = useTheme();

  const renderItem = ({ item }: { item: StyleKey }) => {
    const preview: AvatarConfig = {
      style: item,
      seed,
      options: {},
    };
    const isSel = item === selected;
    return (
      <Pressable
        onPressIn={() => onSelect(item)}
        sx={{
          width: PREVIEW + 12,
          alignItems: 'center',
          gap: 1,
          paddingVertical: 2,
        }}
      >
        <Box
          sx={{
            width: PREVIEW,
            height: PREVIEW,
            borderRadius: PREVIEW / 2,
            borderWidth: 2,
            borderColor: isSel ? theme.colors.tint : theme.colors.border,
            overflow: 'hidden',
          }}
        >
          <ProfileDiceBearAvatar
            config={preview}
            fallbackSeed={principalId}
            size={PREVIEW}
          />
        </Box>
        <Text
          variant="caption"
          sx={{
            fontSize: 9,
            textAlign: 'center',
            opacity: isSel ? 1 : 0.75,
            fontWeight: isSel ? '600' : '400',
          }}
          label={styleLabel(item)}
        />
      </Pressable>
    );
  };

  return (
    <FlatList
      horizontal
      data={STYLE_KEYS}
      keyExtractor={(k) => k}
      renderItem={renderItem}
      showsHorizontalScrollIndicator
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    />
  );
}
