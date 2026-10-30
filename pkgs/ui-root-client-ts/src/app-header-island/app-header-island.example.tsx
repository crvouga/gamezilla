/** @jsxImportSource solid-js */

import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import type { AppHeaderIslandItem } from '@pkgs/ui-root-client-ts/app-header-island-types';
import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import {
  Gamepad2Icon,
  SearchIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const DESTINATIONS = [
  { id: 'spaces', label: 'Spaces', icon: Gamepad2Icon },
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'profile', label: 'Profile', icon: UserIcon },
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
      leading={<AppLogo size={24} />}
      items={items}
      trailing={<p class="text textCaption">{'Actions'}</p>}
    />
  );
}

export default function AppHeaderIslandExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Logo, navigation (current = text color, semibold, underline), actions">
        <SchemePreview>
          <InteractiveHeader />
        </SchemePreview>
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
