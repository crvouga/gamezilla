/** @jsxImportSource @solidjs/web */

import {
  AppHeaderIsland,
  type AppHeaderIslandItem,
} from '@pkgs/ui-root-client-ts/app-header-island';
import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import {
  GamesArt,
  ProfileArt,
  SearchArt,
} from '@pkgs/ui-root-client-ts/illustration';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const DESTINATIONS = [
  { id: 'spaces', label: 'Spaces', icon: GamesArt },
  { id: 'search', label: 'Search', icon: SearchArt },
  { id: 'profile', label: 'Profile', icon: ProfileArt },
] as const;

function InteractiveHeader(): JSX.Element {
  const [current, setCurrent] = createSignal('spaces');
  const items = DESTINATIONS.map(
    (destination): AppHeaderIslandItem => ({
      ...destination,
      get active() {
        return current() === destination.id;
      },
      onClick: () => setCurrent(destination.id),
    })
  );
  return (
    <AppHeaderIsland
      leading={<AppLogo name="acme" size={24} />}
      items={items}
      trailing={<p class="text textCaption">{'Actions'}</p>}
    />
  );
}

export default function AppHeaderIslandExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Navigation with Spaces selected">
        <InteractiveHeader />
      </ExampleSection>
      <ExampleSection title="Leading and trailing only (a space's own chrome)">
        <AppHeaderIsland
          leading={<p class="text textNavigationTitle">{'Friday chess'}</p>}
          trailing={<p class="text textCaption">{'Members'}</p>}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
