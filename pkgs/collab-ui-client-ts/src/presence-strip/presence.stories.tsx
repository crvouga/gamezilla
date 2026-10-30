import { assignParticipantColors } from '@pkgs/collab-root-shared-ts/participant-color';
import type { PresenceStripProps } from '@pkgs/collab-ui-client-ts/presence-strip';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ParticipantDot } from '../participant-dot/index';
import { PresenceRosterList } from '../presence-roster-list/index';
import { PresenceStrip } from './index';

const clients = Array.from({ length: 8 }, (_, n) => ({
  id: `person-${n}`,
  clientId: `tab-${n}`,
}));
const colors = assignParticipantColors(clients.map((client) => client.id));
const color = ((id: string) =>
  colors.get(id)?.css ??
  'var(--ui-color-tint)') satisfies PresenceStripProps['colorForParticipant'];
const avatar = (_actor: { id: string }, size: number) => (
  <Avatar size={size} kind="person" />
);
export default {
  title: 'Product/Presence',
  component: PresenceStrip,
  subcomponents: { PresenceRosterList, ParticipantDot },
  tags: ['autodocs'],
} satisfies Meta;
export const Connected: StoryObj = {
  render: () => (
    <StackVertical gap="md">
      <PresenceStrip
        clients={clients}
        colorForParticipant={color}
        renderAvatar={avatar}
        maxVisible={3}
      />
      <PresenceRosterList
        rows={clients.map((client, n) => ({
          client,
          title: `Player ${n + 1}`,
        }))}
        colorForParticipant={color}
        renderAvatar={avatar}
      />
    </StackVertical>
  ),
};
export const Empty: StoryObj = {
  render: () => (
    <StackVertical gap="md">
      <PresenceRosterList
        rows={[]}
        colorForParticipant={color}
        renderAvatar={avatar}
      />
      <EmptyState
        title="No one else here"
        body="Share the room link to invite another player."
      />
    </StackVertical>
  ),
};
export const Participant: StoryObj = {
  render: () => (
    <StackHorizontal gap="sm">
      <ParticipantDot color={color('person-0')} />
      <P>Player 1</P>
    </StackHorizontal>
  ),
};
