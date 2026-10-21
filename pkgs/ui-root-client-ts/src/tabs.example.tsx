/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection, ExampleTile } from './example-section';
import { StackVertical } from './stack';
import type { TabItem } from './tabs';
import { Tabs } from './tabs';
import { P } from './text';

type ProfileTab = 'games' | 'friends' | 'saved';

const ITEMS: readonly TabItem<ProfileTab>[] = [
  { value: 'games', label: 'Games', badge: 12 },
  { value: 'friends', label: 'Friends', badge: 3 },
  { value: 'saved', label: 'Saved' },
];

const WITH_DISABLED: readonly TabItem[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week', disabled: true },
  { value: 'month', label: 'Month' },
];

function Panel(props: { value: string }): JSX.Element {
  return (
    <StackVertical paddingY="md">
      <ExampleTile label={`${props.value} panel`} />
    </StackVertical>
  );
}

function Controlled(): JSX.Element {
  const [tab, setTab] = createSignal<ProfileTab>('friends');
  return (
    <StackVertical gap="sm">
      <Tabs
        aria-label="Profile, controlled"
        items={ITEMS}
        value={tab()}
        onValueChange={setTab}
      >
        {(value) => <Panel value={value} />}
      </Tabs>
      <P variant="caption">{`Selected: ${tab()}`}</P>
    </StackVertical>
  );
}

export default function TabsExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Underline (default): equal width on compact">
        <Tabs aria-label="Profile" items={ITEMS}>
          {(value) => <Panel value={value} />}
        </Tabs>
      </ExampleSection>
      <ExampleSection title="Pill">
        <Tabs aria-label="Range" items={WITH_DISABLED} variant="pill">
          {(value) => <Panel value={value} />}
        </Tabs>
      </ExampleSection>
      <ExampleSection title="Underline with a disabled tab and a default value">
        <Tabs
          aria-label="Range, underline"
          items={WITH_DISABLED}
          defaultValue="month"
        >
          {(value) => <Panel value={value} />}
        </Tabs>
      </ExampleSection>
      <ExampleSection title="Controlled">
        <Controlled />
      </ExampleSection>
    </ExampleRoot>
  );
}
