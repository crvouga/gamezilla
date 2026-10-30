/** @jsxImportSource solid-js */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge, HostBadge, LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import {
  BellIcon,
  ChevronRightIcon,
  SettingsIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { List, ListItem } from '@pkgs/ui-root-client-ts/list';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { StatPill } from '@pkgs/ui-root-client-ts/stat-pill';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const noop = (): void => undefined;

function Chevron(): JSX.Element {
  return <ChevronRightIcon size={20} color="icon" />;
}

function People(): JSX.Element {
  return (
    <StackVertical gap="sm">
      <P variant="sectionLabel">{'Players in this space'}</P>
      <List>
        <ListItem
          title="Jane Doe"
          subtitle="Plays white"
          leading={<Avatar you initials="JD" size={40} />}
          trailing={<HostBadge size="sm" />}
          onClick={noop}
        />
        <ListItem
          title="Maximiliana Alexandrovna Konstantinopolskaya-Featherstonehaugh"
          subtitle="A name too long for one line ends in an ellipsis, and a subtitle this long is clamped to two lines before it ends in one too"
          leading={<Avatar kind="guest" size={40} />}
          trailing={<Chevron />}
          onClick={noop}
        />
        <ListItem
          title="Stockfish"
          subtitle="Bot (hard)"
          leading={<Avatar kind="bot" size={40} />}
        />
        <ListItem
          title="Open seat"
          subtitle="Anyone in the space can take it"
          leading={<Avatar kind="emptySeat" size={40} />}
          selected
          onClick={noop}
        />
      </List>
    </StackVertical>
  );
}

function Spaces(): JSX.Element {
  return (
    <StackVertical gap="sm">
      <P variant="sectionLabel">{'Live now'}</P>
      <List>
        <ListItem
          title="Friday blitz"
          subtitle="Chess, five minutes each"
          leading={<SettingsIcon size={24} color="icon" />}
          trailing={<LiveBadge />}
          onClick={noop}
        />
        <ListItem
          title="Grand final"
          leading={<BellIcon size={24} color="icon" />}
          trailing={<StatPill value={12_400} label="watching" />}
        />
        <ListItem
          title="Unread"
          trailing={<Badge label="3" intent="destructive" size="sm" />}
          onClick={noop}
        />
      </List>
    </StackVertical>
  );
}

export default function ListExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <StackVertical gap="xl">
          <People />
          <Spaces />
          <ExampleSection title="separator={false}">
            <List separator={false}>
              <ListItem title="Item A" />
              <ListItem title="Item B" />
              <ListItem title="Item C" />
            </List>
          </ExampleSection>
        </StackVertical>
      </SchemePreview>
    </ExampleRoot>
  );
}
