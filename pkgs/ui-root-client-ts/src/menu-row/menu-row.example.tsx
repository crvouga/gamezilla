/** @jsxImportSource solid-js */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import {
  BellIcon,
  EllipsisIcon,
  SettingsIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { OverflowMenuButton } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { StatPill } from '@pkgs/ui-root-client-ts/stat-pill';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

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
      <MenuSection title="Preferences">
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
      <MenuRow
        title="Destructive"
        caption="Ends or removes something; it asks first"
        tone="destructive"
        hideChevron
        onClick={noop}
      />
      <MenuRow title="Link" href="#menu-row" />
    </MenuSection>
  );
}

/** A disclosure row shows or hides the rows after it, in the same panel. */
function DisclosureSection(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  return (
    <MenuSection title="Disclosure">
      <MenuRow
        title="Advanced"
        caption="Rarely needed details"
        expanded={open()}
        onClick={() => setOpen((value) => !value)}
      />
      <Show when={open()}>
        <MenuRow title="Diagnostics" onClick={noop} />
      </Show>
    </MenuSection>
  );
}

function PeopleSection(): JSX.Element {
  return (
    <MenuSection title="People">
      <MenuRow
        title="Jane Doe"
        caption="jane@example.com"
        leading={<Avatar you initials="JD" size={40} />}
        trailing={<HostBadge size="sm" />}
        onClick={noop}
      />
      <MenuRow
        title="Maximiliana Alexandrovna Konstantinopolskaya-Featherstonehaugh"
        caption="A long name ends in an ellipsis; the hairline still starts at the text column past the avatar"
        leading={<Avatar kind="guest" size={40} />}
        onClick={noop}
      />
      <MenuRow
        title="Stockfish"
        leading={<Avatar kind="bot" size={40} />}
        value="Bot (hard)"
      />
      <MenuRow
        title="Open seat"
        leading={<Avatar kind="emptySeat" size={40} />}
        onClick={noop}
      />
    </MenuSection>
  );
}

/**
 * A row that opens something, with a "…" menu of its own beside it: two
 * controls on one hairline, neither inside the other.
 */
function AccessorySection(): JSX.Element {
  const [tapped, setTapped] = createSignal<string | null>(null);
  const more = (title: string): JSX.Element => (
    <OverflowMenuButton
      aria-label={`More for ${title}`}
      icon={EllipsisIcon}
      size={32}
      width={220}
      actions={[
        {
          id: 'remove',
          label: 'Remove',
          onClick: () => setTapped(`Remove ${title}`),
        },
      ]}
    />
  );
  return (
    <>
      <MenuSection title="Puzzles in this pack">
        <MenuRow
          title="Count to five"
          trailing={<Badge label="Published" intent="success" size="sm" />}
          accessory={more('Count to five')}
          onClick={() => setTapped('Count to five')}
        />
        <MenuRow
          title="Count to nine"
          caption="Publish it before the pack"
          trailing={<Badge label="Draft" intent="warning" size="sm" />}
          accessory={more('Count to nine')}
          onClick={() => setTapped('Count to nine')}
        />
      </MenuSection>
      <LastTapped tapped={tapped()} />
    </>
  );
}

function LongTextSection(): JSX.Element {
  return (
    <MenuList>
      <MenuRow
        title="A long value that would crowd the title"
        value="A value long enough to be capped and clamped"
        onClick={noop}
      />
      <MenuRow
        title="Watchers"
        trailing={<StatPill value={12_400} label="watching" />}
      />
    </MenuList>
  );
}

export default function MenuRowExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Rows live in a raised panel under a section label. Hover, press, keyboard focus and disabled each show; the hairline starts at the text column, past any leading icon or avatar.'
        }
      </p>
      <SchemePreview>
        <SettingsSections />
      </SchemePreview>
      <StatesSection />
      <DisclosureSection />
      <PeopleSection />
      <AccessorySection />
      <LongTextSection />
    </ExampleRoot>
  );
}
