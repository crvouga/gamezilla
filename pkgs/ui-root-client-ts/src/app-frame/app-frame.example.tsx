/** @jsxImportSource solid-js */

import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import { HouseIcon, SearchIcon, UserIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

function OverrideDemo(): JSX.Element {
  useSetAppFrameHeader(
    <AppHeaderIsland
      leading={<p class="text textNavigationTitle">{'Space chrome'}</p>}
    />
  );
  return <p class="text">{'Body under an overridden AppFrame header.'}</p>;
}

function Header(): JSX.Element {
  return (
    <AppHeaderIsland
      leading={<AppLogo size={24} />}
      items={[
        {
          id: 'home',
          label: 'Home',
          icon: HouseIcon,
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
  );
}

export default function AppFrameExample(): JSX.Element {
  return (
    <ExampleRoot grow minHeight="md">
      <ExampleSection title="Regions: header (wide) with nav, content; compact draws a TabBar in the tab-root layout instead">
        <AppFrameChromeProvider
          globalTrailing={<p class="text textCaption">{'Avatar'}</p>}
        >
          <AppFrame header={<Header />}>
            <p class="text">
              {'Content (wide: centered column on the surface backdrop).'}
            </p>
          </AppFrame>
        </AppFrameChromeProvider>
      </ExampleSection>
      <ExampleSection title="A screen replacing the header for its lifetime">
        <AppFrameChromeProvider>
          <AppFrame header={<Header />}>
            <OverrideDemo />
          </AppFrame>
        </AppFrameChromeProvider>
      </ExampleSection>
    </ExampleRoot>
  );
}
