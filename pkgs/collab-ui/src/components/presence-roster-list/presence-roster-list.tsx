/**
 * Roster list: one row per connected client.
 */

import type { ParticipantColor } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import {
  type ComponentDataSet,
  componentDataAttrs,
  List,
  ListItem,
  Stack,
  StatusDot,
} from '@pkgs/ui';
import { For, type JSX } from 'solid-js';

import { ParticipantColorRing } from '../participant-color-ring';

export type PresenceRosterRow = {
  readonly client: RoomActor;
  readonly title: LocalizedString;
  readonly subtitle?: LocalizedString;
  readonly isYou?: boolean;
  readonly isThisTab?: boolean;
  readonly isHost?: boolean;
  readonly badges?: JSX.Element;
};

export type PresenceRosterListProps = {
  rows: readonly PresenceRosterRow[];
  colorForParticipant: (participantId: string) => ParticipantColor | string;
  renderAvatar: (actor: RoomActor, size: number) => JSX.Element;
  dataSet?: ComponentDataSet;
};

function resolveColor(
  colorForParticipant: PresenceRosterListProps['colorForParticipant'],
  participantId: string
): string {
  const c = colorForParticipant(participantId);
  return typeof c === 'string' ? c : c.css;
}

export function PresenceRosterList(
  props: PresenceRosterListProps
): JSX.Element {
  return (
    <List {...componentDataAttrs('PresenceRosterList', props.dataSet)}>
      <For each={props.rows}>
        {(row) => (
          <ListItem
            title={row.title}
            {...(row.subtitle !== undefined ? { subtitle: row.subtitle } : {})}
            leading={
              <Stack direction="horizontal" spacing={2} align="center">
                <ParticipantColorRing
                  color={resolveColor(props.colorForParticipant, row.client.id)}
                  size={40}
                  borderWidth={2}
                >
                  {props.renderAvatar(row.client, 36)}
                </ParticipantColorRing>
                <StatusDot status="online" size={8} />
              </Stack>
            }
            trailing={row.badges}
          />
        )}
      </For>
    </List>
  );
}
