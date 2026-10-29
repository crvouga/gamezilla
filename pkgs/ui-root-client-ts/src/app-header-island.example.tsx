/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { AppHeaderIsland } from './app-header-island';
import type { AppHeaderIslandItem } from './app-header-island-types';
import { AppLogo } from './app-logo';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Gamepad2Icon, SearchIcon, UserIcon } from './icons';
import { SchemePreview } from './scheme-preview';

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
      leading={<AppLogo name="acme" size={24} />}
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
