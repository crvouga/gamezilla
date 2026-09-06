import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { Card } from '../card';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { List, ListItem } from './list';

export default function ListExample() {
  return (
    <ExampleRoot>
      <Card elevation={0} sx={{ overflow: 'hidden' }}>
        <List>
          <ListItem
            title="Profile"
            subtitle="Edit your personal info"
            leading={<Avatar initials="JD" size={36} />}
            trailing={<Text variant="caption" label="›" />}
            onPress={() => {}}
          />
          <ListItem
            title="Notifications"
            subtitle="Manage alerts"
            leading={<Avatar initials="🔔" size={36} background="warning" />}
            trailing={<Badge label="3" intent="destructive" size="sm" />}
            onPress={() => {}}
          />
          <ListItem
            title="Selected row"
            subtitle="Highlights with tintSubtle background"
            leading={<Avatar initials="⭐" size={36} background="tint" />}
            trailing={<Text variant="caption" label="›" />}
            selected
            onPress={() => {}}
          />
          <ListItem
            title="Privacy"
            leading={<Avatar initials="🔒" size={36} background="info" />}
            trailing={<Text variant="caption" label="›" />}
            onPress={() => {}}
          />
        </List>
      </Card>

      <Text variant="label" label="Without separators" />
      <Card elevation={0} sx={{ overflow: 'hidden' }}>
        <List separator={false}>
          <ListItem title="Item A" />
          <ListItem title="Item B" />
          <ListItem title="Item C" />
        </List>
      </Card>
    </ExampleRoot>
  );
}
