import type { LocalizedString } from '@pkgs/i18n';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { MenuIcon, SettingsIcon, UserIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import { OverflowMenuButton } from './overflow-menu-button';

const DEMO_ACTIONS = [
  {
    id: 'account',
    label: 'Account',
    subtitle: 'Signed in',
    icon: UserIcon,
    onPress: () => {},
    endsGroup: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    onPress: () => {},
  },
] as const;

export default function OverflowMenuButtonExample() {
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
          accessibilityLabel={'More actions' as LocalizedString}
          icon={MenuIcon}
        />
        <OverflowMenuButton
          actions={DEMO_ACTIONS}
          header={{
            title: 'Account',
            subtitle: 'Guest',
            avatar: (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 'full',
                  background: 'tint',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserIcon size={20} />
              </Box>
            ),
          }}
          accessibilityLabel={'Account menu' as LocalizedString}
          trigger={
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 'full',
                background: 'tint',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserIcon size={16} />
            </Box>
          }
        />
      </Stack>
    </ExampleRoot>
  );
}
