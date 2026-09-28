/** @jsxImportSource solid-js */
import { createSignal, type JSX, Show } from 'solid-js';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { ExampleRoot } from '../explorer/example-root';
import { SettingsIcon, UserIcon } from '../icons';
import { MenuList } from './menu-list';
import { MenuRow } from './menu-row';

const noop = (): void => undefined;

function CardGroup(props: { children: JSX.Element }): JSX.Element {
  return <div class="card overflow-hidden px-3">{props.children}</div>;
}

/** Simulates ScreenBase body padding so MenuList's negative bleed is visible. */
function ScreenBodyHarness(props: { children: JSX.Element }): JSX.Element {
  return <div class="box p-4 bg-surface">{props.children}</div>;
}

function LastTapped(props: { tapped: string | null }): JSX.Element {
  return (
    <Show when={props.tapped}>
      {(tapped) => <p class="text textCaption">{`Last tapped: ${tapped()}`}</p>}
    </Show>
  );
}

function FullBleedListSection(): JSX.Element {
  const [tapped, setTapped] = createSignal<string | null>(null);
  return (
    <>
      <label class="text textLabel">
        {'MenuList — full-bleed ScreenBase menu screen'}
      </label>
      <ScreenBodyHarness>
        <MenuList>
          <MenuRow
            title="Appearance"
            caption="Light, dark, or system theme"
            onClick={() => setTapped('Appearance')}
          />
          <MenuRow
            title="Connection"
            caption="Network reachability and API server health"
            onClick={() => setTapped('Connection')}
          />
          <MenuRow
            title="About"
            caption="App version, build, and commit hash"
            onClick={() => setTapped('About')}
          />
        </MenuList>
      </ScreenBodyHarness>
      <LastTapped tapped={tapped()} />
    </>
  );
}

function DefaultRowsSection(): JSX.Element {
  const [tapped, setTapped] = createSignal<string | null>(null);
  return (
    <>
      <label class="text textLabel">
        {'Default — title + caption + chevron'}
      </label>
      <CardGroup>
        <MenuRow
          title="Appearance"
          caption="Light, dark, or system theme"
          onClick={() => setTapped('Appearance')}
        />
        <MenuRow
          title="Connection"
          caption="Network reachability and API server health"
          onClick={() => setTapped('Connection')}
        />
        <MenuRow
          title="About"
          caption="App version, build, and commit hash"
          onClick={() => setTapped('About')}
        />
      </CardGroup>
      <LastTapped tapped={tapped()} />
    </>
  );
}

function TitleOnlySection(): JSX.Element {
  return (
    <>
      <label class="text textLabel">{'Title only (no caption)'}</label>
      <CardGroup>
        <MenuRow title="Profile" onClick={noop} />
        <MenuRow title="Privacy" onClick={noop} />
        <MenuRow title="Notifications" onClick={noop} />
      </CardGroup>
    </>
  );
}

function LeadingIconSection(): JSX.Element {
  return (
    <>
      <label class="text textLabel">{'With leading icon'}</label>
      <CardGroup>
        <MenuRow
          title="Account"
          caption="Manage your profile"
          leading={<UserIcon size={20} color="icon" />}
          onClick={noop}
        />
        <MenuRow
          title="Settings"
          caption="App preferences and tools"
          leading={<SettingsIcon size={20} color="icon" />}
          onClick={noop}
        />
      </CardGroup>
    </>
  );
}

function VariantsSection(): JSX.Element {
  return (
    <>
      <label class="text textLabel">{'With leading avatar'}</label>
      <CardGroup>
        <MenuRow
          title="Jane Doe"
          caption="jane@example.com"
          leading={<Avatar initials="JD" size={36} />}
          onClick={noop}
        />
      </CardGroup>

      <label class="text textLabel">{'Custom trailing (badge)'}</label>
      <CardGroup>
        <MenuRow
          title="Inbox"
          caption="Direct messages and mentions"
          trailing={<Badge label="3" intent="destructive" size="sm" />}
          onClick={noop}
        />
      </CardGroup>

      <label class="text textLabel">{'Selected state'}</label>
      <CardGroup>
        <MenuRow
          title="Light"
          caption="Currently selected appearance"
          selected
          hideChevron
          onClick={noop}
        />
        <MenuRow title="Dark" hideChevron onClick={noop} />
        <MenuRow title="System" hideChevron onClick={noop} />
      </CardGroup>

      <label class="text textLabel">{'No chevron'}</label>
      <CardGroup>
        <MenuRow
          title="Static info"
          caption="Not a destination — chevron suppressed"
          hideChevron
        />
      </CardGroup>

      <label class="text textLabel">{'Disabled'}</label>
      <CardGroup>
        <MenuRow
          title="Coming soon"
          caption="This feature is not yet available"
          disabled
          onClick={noop}
        />
      </CardGroup>
    </>
  );
}

export default function MenuRowExample(): JSX.Element {
  return (
    <ExampleRoot>
      <FullBleedListSection />
      <DefaultRowsSection />
      <TitleOnlySection />
      <LeadingIconSection />
      <VariantsSection />
    </ExampleRoot>
  );
}
