/** @jsxImportSource solid-js */

import {
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { OverflowMenuAction } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { OverflowMenuButton } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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
  {
    id: 'export',
    label: 'Export (unavailable)',
    icon: SettingsIcon,
    disabled: true,
    onClick: () => undefined,
    endsGroup: true,
  },
  {
    id: 'sign-out',
    label: 'Sign out',
    icon: LogOutIcon,
    onClick: () => undefined,
  },
];

function AvatarDisc(props: { large?: boolean }): JSX.Element {
  return (
    <div
      class="box rounded-full bg-surface-muted items-center justify-center"
      classList={{ 'size-10': props.large === true, 'size-8': !props.large }}
    >
      <UserIcon size={props.large === true ? 24 : 20} color="icon" />
    </div>
  );
}

export default function OverflowMenuButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {
          'Default icon trigger (40px, 24px glyph), a compact 32px trigger, and a custom avatar trigger. Menus float with one hairline and the float shadow.'
        }
      </p>
      <div class="box flex-row gap-4 items-center">
        <OverflowMenuButton
          actions={DEMO_ACTIONS}
          header={{ title: 'More' }}
          aria-label="More actions"
          icon={MenuIcon}
        />
        <OverflowMenuButton
          actions={DEMO_ACTIONS}
          header={{ title: 'More' }}
          aria-label="More actions (compact)"
          size={32}
        />
        <OverflowMenuButton
          actions={DEMO_ACTIONS}
          header={{
            title: 'Account',
            subtitle: 'Guest',
            avatar: <AvatarDisc large />,
          }}
          aria-label="Account menu"
          trigger={<AvatarDisc />}
        />
      </div>
    </ExampleRoot>
  );
}
