/**
 * Presence strip: one face per connected client, ringed in participant color.
 */

import type { ParticipantColor } from '@pkgs/collab';
import type { RoomActor } from '@pkgs/room';
import { AvatarGroup, type ComponentDataSet, componentDataSet } from '@pkgs/ui';
import { For, type JSX } from 'solid-js';

import { ParticipantColorRing } from '../participant-color-ring';

export type PresenceStripProps = {
  /** Flat per-client roster (same order as the server snapshot). */
  clients: readonly RoomActor[];
  colorForParticipant: (participantId: string) => ParticipantColor | string;
  renderAvatar: (actor: RoomActor, size: number) => JSX.Element;
  size?: number;
  maxVisible?: number;
  onPress?: () => void;
  dataSet?: ComponentDataSet;
};

function resolveColor(
  colorForParticipant: PresenceStripProps['colorForParticipant'],
  participantId: string
): string {
  const c = colorForParticipant(participantId);
  return typeof c === 'string' ? c : c.css;
}

export function PresenceStrip(props: PresenceStripProps): JSX.Element {
  const ringSize = () => (props.size ?? 32) + 4;
  return (
    <AvatarGroup
      size={ringSize()}
      maxVisible={props.maxVisible ?? 5}
      onPress={props.onPress}
      {...componentDataSet('PresenceStrip', props.dataSet)}
    >
      <For each={props.clients}>
        {(client) => (
          <ParticipantColorRing
            color={resolveColor(props.colorForParticipant, client.id)}
            size={ringSize()}
            borderWidth={2}
          >
            {props.renderAvatar(client, props.size ?? 32)}
          </ParticipantColorRing>
        )}
      </For>
    </AvatarGroup>
  );
}
