import { UserIcon } from '../icons';
import { Box } from '../box';
import { Stack } from '../stack';
import { Text } from '../text';
import { IconButton, iconButtonAvatarContentSize } from './icon-button';

const AVATAR_BUTTON_SIZE = 40;

export default function IconButtonExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="IconButton" />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Hover (web) or long-press (native) to see tooltips."
      />

      <Stack direction="horizontal" spacing={3} align="center">
        <IconButton label="Close" onPress={() => {}} background="surface">
          <Text variant="body" label="✕" />
        </IconButton>

        <IconButton label="Add" onPress={() => {}} size={48} background="tint">
          <Text variant="bodyBold" label="+" />
        </IconButton>

        <IconButton
          label="Delete"
          onPress={() => {}}
          size={32}
          background="destructive"
        >
          <Text sx={{ fontSize: 'xs' }} label="🗑" />
        </IconButton>

        <IconButton
          label="Settings"
          disabled
          onPress={() => {}}
          background="surface"
        >
          <Text variant="body" label="⚙" />
        </IconButton>

        <IconButton
          variant="avatar"
          label="Account"
          onPress={() => {}}
          size={AVATAR_BUTTON_SIZE}
        >
          <UserIcon size={iconButtonAvatarContentSize(AVATAR_BUTTON_SIZE)} />
        </IconButton>
      </Stack>
    </Box>
  );
}
