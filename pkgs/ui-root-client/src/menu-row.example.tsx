/** @jsxImportSource solid-js */
import { createSignal, type JSX, Show } from 'solid-js';
import { Avatar } from './avatar';
import { Badge } from './badge';
import { ExampleRoot } from './example-root';
import { BellIcon, SettingsIcon, UserIcon } from './icons';
import { MenuList } from './menu-list';
import { MenuRow } from './menu-row';
import { MenuSection } from './menu-section';
import { SchemePreview } from './scheme-preview';
import { Switch } from './switch';

const noop = (): void => undefined;

function LastTapped(props: { tapped: string | null }): JSX.Element {
  return (
    <Show when={props.tapped}>
      {(tapped) => <p class="text textCaption">{`Last tapped: ${tapped()}`}</p>}
    </Show>
  );
}

function SettingsSections(): JSX.Element {
  const [tapped, setTapped] = createSignal<string | null>(null);
  const [sound, setSound] = createSignal(true);
  return (
    <div class="box gap-6">
      <MenuSection
        title="Account"
        footer="Your name and picture are visible to everyone you play."
      >
        <MenuRow
          title="Profile"
          leading={<UserIcon size={24} color="icon" />}
          onClick={() => setTapped('Profile')}
        />
        <MenuRow
          title="Notifications"
          leading={<BellIcon size={24} color="icon" />}
          trailing={<Badge label="3" intent="destructive" size="sm" />}
          onClick={() => setTapped('Notifications')}
        />
        <MenuRow
          title="Settings"
          leading={<SettingsIcon size={24} color="icon" />}
          value="Dark"
          onClick={() => setTapped('Settings')}
        />
      </MenuSection>
      <MenuSection title="Preferences" role="group">
        <MenuRow
          title="Sound"
          caption="Never changes the device volume"
          trailing={
            <Switch
              value={sound()}
              onValueChange={setSound}
              aria-label="Sound"
            />
          }
        />
        <MenuRow title="Version" value="1.2.0" />
      </MenuSection>
      <LastTapped tapped={tapped()} />
    </div>
  );
}

function StatesSection(): JSX.Element {
  return (
    <MenuSection title="States">
      <MenuRow
        title="Default"
        caption="Title, caption and chevron"
        onClick={noop}
      />
      <MenuRow title="Selected" selected hideChevron onClick={noop} />
      <MenuRow
        title="Disabled"
        caption="Not available yet"
        disabled
        onClick={noop}
      />
      <MenuRow title="Static" caption="Not a destination, so no chevron" />
      <MenuRow title="Link" href="#menu-row" />
    </MenuSection>
  );
}

function PeopleSection(): JSX.Element {
  return (
    <MenuList>
      <MenuRow
        title="Jane Doe"
        caption="jane@example.com"
        leading={<Avatar initials="JD" size={36} />}
        onClick={noop}
      />
      <MenuRow
        title="A long value that would crowd the title"
        value="A value long enough to be capped and clamped"
        onClick={noop}
      />
    </MenuList>
  );
}

export default function MenuRowExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Rows live in a hairline panel. Hover, press, keyboard focus and disabled each show; the hairline starts at the text column.'
        }
      </p>
      <SchemePreview>
        <SettingsSections />
      </SchemePreview>
      <StatesSection />
      <PeopleSection />
    </ExampleRoot>
  );
}
