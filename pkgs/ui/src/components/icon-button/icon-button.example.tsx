/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { UserIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import { IconButton, iconButtonAvatarContentSize } from './icon-button';

const AVATAR_BUTTON_SIZE = 40;

export default function IconButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Hover or focus to see tooltips."
      />

      <Stack direction="horizontal" spacing={3} align="center">
        <IconButton
          label="Close"
          onClick={() => undefined}
          background="surface"
        >
          <Text variant="body" label="✕" />
        </IconButton>

        <IconButton
          label="Add"
          onClick={() => undefined}
          size={48}
          background="tint"
        >
          <Text variant="bodyBold" label="+" />
        </IconButton>

        <IconButton
          label="Delete"
          onClick={() => undefined}
          size={32}
          background="destructive"
        >
          <Text sx={{ fontSize: 'xs' }} label="🗑" />
        </IconButton>

        <IconButton
          label="Settings"
          disabled
          onClick={() => undefined}
          background="surface"
        >
          <Text variant="body" label="⚙" />
        </IconButton>

        <IconButton
          variant="avatar"
          label="Account"
          onClick={() => undefined}
          size={AVATAR_BUTTON_SIZE}
        >
          <UserIcon size={iconButtonAvatarContentSize(AVATAR_BUTTON_SIZE)} />
        </IconButton>
      </Stack>
    </ExampleRoot>
  );
}
