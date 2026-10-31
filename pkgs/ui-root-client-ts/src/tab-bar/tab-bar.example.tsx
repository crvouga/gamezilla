/** @jsxImportSource solid-js */

import {
  BellIcon,
  HouseIcon,
  SearchIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { TabBar, type TabBarItem } from '@pkgs/ui-root-client-ts/tab-bar';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const DESTINATIONS = [
  { id: 'home', label: 'Home', icon: HouseIcon },
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'activity', label: 'Activity', icon: BellIcon, badge: '3' },
  { id: 'profile', label: 'Profile', icon: UserIcon },
] as const;

function InteractiveTabBar(): JSX.Element {
  const [current, setCurrent] = createSignal('home');
  const items = DESTINATIONS.map(
    (destination): TabBarItem => ({
      ...destination,
      get current() {
        return current() === destination.id;
      },
      onPress: () => setCurrent(destination.id),
    })
  );
  return <TabBar aria-label="Example navigation" items={items} />;
}

export default function TabBarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Buttons: press to move the current page; badge on Activity">
        <SchemePreview>
          <InteractiveTabBar />
        </SchemePreview>
      </ExampleSection>
      <ExampleSection title="Links: each item is a real link (open in a new tab works)">
        <TabBar
          aria-label="Example links"
          items={[
            {
              id: 'home',
              label: 'Home',
              icon: HouseIcon,
              current: false,
              href: '#home',
            },
            {
              id: 'search',
              label: 'Search',
              icon: SearchIcon,
              current: true,
              href: '#search',
            },
            {
              id: 'profile',
              label: 'A long destination label',
              icon: UserIcon,
              current: false,
              href: '#profile',
            },
          ]}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
