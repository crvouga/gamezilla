/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { Card } from '../card';
import { ExampleRoot } from '../explorer/example-root';
import { List, ListItem } from './list';

const noop = (): void => undefined;

export default function ListExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Card class="overflow-hidden" elevation={0}>
        <List>
          <ListItem
            title="Profile"
            subtitle="Edit your personal info"
            leading={<Avatar initials="JD" size={36} />}
            trailing={<p class="text textCaption">{'›'}</p>}
            onClick={noop}
          />
          <ListItem
            title="Notifications"
            subtitle="Manage alerts"
            leading={<Avatar initials="🔔" size={36} background="warning" />}
            trailing={<Badge label="3" intent="destructive" size="sm" />}
            onClick={noop}
          />
          <ListItem
            title="Selected row"
            subtitle="Highlights with tintSubtle background"
            leading={<Avatar initials="⭐" size={36} background="tint" />}
            trailing={<p class="text textCaption">{'›'}</p>}
            selected
            onClick={noop}
          />
          <ListItem
            title="Privacy"
            leading={<Avatar initials="🔒" size={36} background="info" />}
            trailing={<p class="text textCaption">{'›'}</p>}
            onClick={noop}
          />
        </List>
      </Card>

      <label class="text textLabel">{'Without separators'}</label>
      <Card class="overflow-hidden" elevation={0}>
        <List separator={false}>
          <ListItem title="Item A" />
          <ListItem title="Item B" />
          <ListItem title="Item C" />
        </List>
      </Card>
    </ExampleRoot>
  );
}
