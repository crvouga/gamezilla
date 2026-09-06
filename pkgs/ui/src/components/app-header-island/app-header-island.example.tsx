/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { AppLogo } from '../app-logo';
import { ExampleRoot } from '../explorer/example-root';
import { Gamepad2Icon, SearchIcon, UserIcon } from '../icons';
import { AppHeaderIsland } from './app-header-island';

export default function AppHeaderIslandExample(): JSX.Element {
  return (
    <ExampleRoot>
      <AppHeaderIsland
        leading={<AppLogo size={24} />}
        items={[
          {
            id: 'spaces',
            label: 'Spaces',
            icon: Gamepad2Icon,
            active: true,
            onClick: () => undefined,
          },
          {
            id: 'search',
            label: 'Search',
            icon: SearchIcon,
            active: false,
            onClick: () => undefined,
          },
          {
            id: 'profile',
            label: 'Profile',
            icon: UserIcon,
            active: false,
            onClick: () => undefined,
          },
        ]}
      />
    </ExampleRoot>
  );
}
