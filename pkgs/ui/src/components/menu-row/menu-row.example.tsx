import { useState } from 'react';
import { useTheme } from '../../theme';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { Box } from '../box';
import { Card } from '../card';
import { SettingsIcon, UserIcon } from '../icons';
import { Text } from '../text';
import { MenuList } from './menu-list';
import { MenuRow } from './menu-row';
import { ExampleRoot } from '../explorer/example-root';

function CardGroup({ children }: { children: React.ReactNode }) {
  return (
    <Card elevation={0} sx={{ overflow: 'hidden', px: 3 }}>
      {children}
    </Card>
  );
}

/** Simulates ScreenBase body padding so MenuList's mx: -4 bleed is visible. */
function ScreenBodySim({ children }: { children: React.ReactNode }) {
  return <Box sx={{ p: 4, background: 'surface' }}>{children}</Box>;
}

function FullBleedListSection() {
  const [tapped, setTapped] = useState<string | null>(null);
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
            onPress={() => setTapped('Appearance')}
          />
          <MenuRow
            title="Connection"
            caption="Network reachability and API server health"
            onPress={() => setTapped('Connection')}
          />
          <MenuRow
            title="About"
            caption="App version, build, and commit hash"
            onPress={() => setTapped('About')}
          />
        </MenuList>
      </ScreenBodySim>
      {tapped ? (
        <Text variant="caption" label={`Last tapped: ${tapped}`} />
      ) : null}
    </>
  );
}

function DefaultRowsSection() {
  const [tapped, setTapped] = useState<string | null>(null);
  return (
    <>
      <Text variant="label" label="Default — title + caption + chevron" />
      <CardGroup>
        <MenuRow
          title="Appearance"
          caption="Light, dark, or system theme"
          onPress={() => setTapped('Appearance')}
        />
        <MenuRow
          title="Connection"
          caption="Network reachability and API server health"
          onPress={() => setTapped('Connection')}
        />
        <MenuRow
          title="About"
          caption="App version, build, and commit hash"
          onPress={() => setTapped('About')}
        />
      </CardGroup>
      {tapped ? (
        <Text variant="caption" label={`Last tapped: ${tapped}`} />
      ) : null}
    </>
  );
}

function TitleOnlySection() {
  return (
    <>
      <Text variant="label" label="Title only (no caption)" />
      <CardGroup>
        <MenuRow title="Profile" onPress={() => {}} />
        <MenuRow title="Privacy" onPress={() => {}} />
        <MenuRow title="Notifications" onPress={() => {}} />
      </CardGroup>
    </>
  );
}

function LeadingIconSection() {
  const theme = useTheme();
  return (
    <>
      <Text variant="label" label="With leading icon" />
      <CardGroup>
        <MenuRow
          title="Account"
          caption="Manage your profile"
          leading={<UserIcon size={20} color={theme.colors.icon} />}
          onPress={() => {}}
        />
        <MenuRow
          title="Settings"
          caption="App preferences and tools"
          leading={<SettingsIcon size={20} color={theme.colors.icon} />}
          onPress={() => {}}
        />
      </CardGroup>
    </>
  );
}

function VariantsSection() {
  return (
    <>
      <Text variant="label" label="With leading avatar" />
      <CardGroup>
        <MenuRow
          title="Jane Doe"
          caption="jane@example.com"
          leading={<Avatar initials="JD" size={36} />}
          onPress={() => {}}
        />
      </CardGroup>

      <Text variant="label" label="Custom trailing (badge)" />
      <CardGroup>
        <MenuRow
          title="Inbox"
          caption="Direct messages and mentions"
          trailing={<Badge label="3" intent="destructive" size="sm" />}
          onPress={() => {}}
        />
      </CardGroup>

      <Text variant="label" label="Selected state" />
      <CardGroup>
        <MenuRow
          title="Light"
          caption="Currently selected appearance"
          selected
          hideChevron
          onPress={() => {}}
        />
        <MenuRow title="Dark" hideChevron onPress={() => {}} />
        <MenuRow title="System" hideChevron onPress={() => {}} />
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
          onPress={() => {}}
        />
      </CardGroup>
    </>
  );
}

export default function MenuRowExample() {
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
