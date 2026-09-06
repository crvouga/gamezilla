/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { MenuIcon, SettingsIcon, UserIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import {
  type OverflowMenuAction,
  OverflowMenuButton,
} from './overflow-menu-button';

const DEMO_ACTIONS: readonly OverflowMenuAction[] = [
  {
    id: 'account',
    label: 'Account',
    subtitle: 'Signed in',
    icon: UserIcon,
    onClick: () => undefined,
    endsGroup: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    onClick: () => undefined,
  },
];

function AvatarDisc(props: { size: number; iconSize: number }): JSX.Element {
  return (
    <Box
      sx={{
        width: props.size,
        height: props.size,
        borderRadius: 'full',
        background: 'tint',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <UserIcon size={props.iconSize} color="onPrimary" />
    </Box>
  );
}

export default function OverflowMenuButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Default IconButton trigger and custom avatar trigger."
      />
      <Stack direction="horizontal" spacing={4} align="center">
        <OverflowMenuButton
          actions={DEMO_ACTIONS}
          header={{ title: 'More' }}
          aria-label="More actions"
          icon={MenuIcon}
        />
        <OverflowMenuButton
          actions={DEMO_ACTIONS}
          header={{
            title: 'Account',
            subtitle: 'Guest',
            avatar: <AvatarDisc size={40} iconSize={20} />,
          }}
          aria-label="Account menu"
          trigger={<AvatarDisc size={32} iconSize={16} />}
        />
      </Stack>
    </ExampleRoot>
  );
}
