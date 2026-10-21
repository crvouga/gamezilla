import type { RoomActor } from '@pkgs/room-root-shared-ts/types';

export type ParticipantPresence = {
  /** Stable participant id (account / device). */
  readonly id: string;
  /** One entry per connected client for this participant. */
  readonly clients: readonly RoomActor[];
  readonly clientCount: number;
  /** True when any of this participant's clients is the local tab. */
  readonly isYou: boolean;
};

/**
 * Group a flat per-client roster into per-participant buckets.
 * Order is stable by first-seen participant id in the input roster.
 * Within a participant, clients keep input order.
 */
export function groupRosterByParticipant(
  roster: readonly RoomActor[],
  selfClientId: string | null
): readonly ParticipantPresence[] {
  const order: string[] = [];
  const byId = new Map<string, RoomActor[]>();
  for (const client of roster) {
    const existing = byId.get(client.id);
    if (existing === undefined) {
      order.push(client.id);
      byId.set(client.id, [client]);
    } else {
      existing.push(client);
    }
  }
  return order.map((id) => {
    const clients = byId.get(id)!;
    const isYou =
      selfClientId !== null && clients.some((c) => c.clientId === selfClientId);
    return {
      id,
      clients,
      clientCount: clients.length,
      isYou,
    };
  });
}
