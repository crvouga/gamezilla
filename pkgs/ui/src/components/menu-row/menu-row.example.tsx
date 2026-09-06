/** @jsxImportSource solid-js */
import { createSignal, type JSX, Show } from 'solid-js';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { Box } from '../box';
import { Card } from '../card';
import { ExampleRoot } from '../explorer/example-root';
import { SettingsIcon, UserIcon } from '../icons';
import { Text } from '../text';
import { MenuList } from './menu-list';
import { MenuRow } from './menu-row';

const noop = (): void => undefined;

function CardGroup(props: { children: JSX.Element }): JSX.Element {
  return (
    <Card elevation={0} sx={{ overflow: 'hidden', px: 3 }}>
      {props.children}
    </Card>
  );
}

/** Simulates ScreenBase body padding so MenuList's negative bleed is visible. */
function ScreenBodySim(props: { children: JSX.Element }): JSX.Element {
  return <Box sx={{ p: 4, background: 'surface' }}>{props.children}</Box>;
}

function LastTapped(props: { tapped: string | null }): JSX.Element {
  return (
    <Show when={props.tapped}>
      {(tapped) => (
        <Text variant="caption" label={`Last tapped: ${tapped()}`} />
      )}
    </Show>
  );
}

function FullBleedListSection(): JSX.Element {
  const [tapped, setTapped] = createSignal<string | null>(null);
  return (
    <>
      <Text
        variant="label"
        label="MenuList — full-bleed ScreenBase menu screen"
      />
      <ScreenBodySim>
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
      </ScreenBodySim>
      <LastTapped tapped={tapped()} />
    </>
  );
}

function DefaultRowsSection(): JSX.Element {
  const [tapped, setTapped] = createSignal<string | null>(null);
  return (
    <>
      <Text variant="label" label="Default — title + caption + chevron" />
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
      <Text variant="label" label="Title only (no caption)" />
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
      <Text variant="label" label="With leading icon" />
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
      <Text variant="label" label="With leading avatar" />
      <CardGroup>
        <MenuRow
          title="Jane Doe"
          caption="jane@example.com"
          leading={<Avatar initials="JD" size={36} />}
          onClick={noop}
        />
      </CardGroup>

      <Text variant="label" label="Custom trailing (badge)" />
      <CardGroup>
        <MenuRow
          title="Inbox"
          caption="Direct messages and mentions"
          trailing={<Badge label="3" intent="destructive" size="sm" />}
          onClick={noop}
        />
      </CardGroup>

      <Text variant="label" label="Selected state" />
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

      <Text variant="label" label="No chevron" />
      <CardGroup>
        <MenuRow
          title="Static info"
          caption="Not a destination — chevron suppressed"
          hideChevron
        />
      </CardGroup>

      <Text variant="label" label="Disabled" />
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
