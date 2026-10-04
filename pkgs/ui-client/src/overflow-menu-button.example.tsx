/** @jsxImportSource solid-js */

import { cssPx } from '@pkgs/ui-shared/css-px';
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { MenuIcon, SettingsIcon, UserIcon } from './icons';
import type { OverflowMenuAction } from './overflow-menu-button';
import { OverflowMenuButton } from './overflow-menu-button';

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
    <div
      class="box rounded-full bg-tint items-center justify-center"
      style={{ width: cssPx(props.size), height: cssPx(props.size) }}
    >
      <UserIcon size={props.iconSize} color="onPrimary" />
    </div>
  );
}

export default function OverflowMenuButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {'Default IconButton trigger and custom avatar trigger.'}
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
          header={{
            title: 'Account',
            subtitle: 'Guest',
            avatar: <AvatarDisc size={40} iconSize={20} />,
          }}
          aria-label="Account menu"
          trigger={<AvatarDisc size={32} iconSize={16} />}
        />
      </div>
    </ExampleRoot>
  );
}
