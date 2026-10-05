import { MAX_WELCOME_ENTRIES_PER_FRAME } from '@pkgs/room-root-shared/bounds';
import type { RoomStorage } from '@pkgs/room-root-shared/server-core-storage';
import type { RoomActor } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared/wire';

type Sender = (payload: unknown) => void;

/**
 * Single-snapshot welcome: load events once, tip from batch (or the server's
 * cached tip only when empty). Caps entries; client re-syncs for the rest.
 */
export async function sendWelcomeFrame(args: {
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly fromSeq: number;
  readonly send: Sender;
  readonly roster: readonly RoomActor[];
  readonly tip: () => Promise<number>;
}): Promise<void> {
  try {
    const all = await args.storage.loadEventsAfter(args.topic, args.fromSeq);
    const tip = all.length > 0 ? all[all.length - 1]!.seq : await args.tip();
    const entries =
      all.length > MAX_WELCOME_ENTRIES_PER_FRAME
        ? all.slice(0, MAX_WELCOME_ENTRIES_PER_FRAME)
        : all;
    args.send({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: args.fromSeq,
      lastSeq: tip,
      entries,
    });
    args.send({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: args.roster,
    });
  } catch (err: unknown) {
    args.send({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.rejected,
      commandId: '__welcome__',
      error: {
        type: ROOM_ERROR_TYPE.internal,
        reason: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/**
 * Fan-out of ONE frame object to every connection (adapters may memoize its
 * serialization per object); drop sockets whose `send` throws (never swallow).
 */
export function broadcastToConnections(
  connections: Map<string, { readonly id: string; readonly send: Sender }>,
  payload: unknown
): void {
  let dead: string[] | null = null;
  for (const conn of connections.values()) {
    try {
      conn.send(payload);
    } catch {
      (dead ??= []).push(conn.id);
    }
  }
  if (dead !== null) {
    for (const id of dead) connections.delete(id);
  }
}
