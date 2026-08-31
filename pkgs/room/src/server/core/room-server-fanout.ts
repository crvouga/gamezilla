import { MAX_WELCOME_ENTRIES_PER_FRAME } from '../../bounds';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { ROOM_ERROR_TYPE, type RoomActor } from '../../types';
import type { RoomStorage } from './storage';

type Sender = (payload: unknown) => void;

/**
 * Single-snapshot welcome: load events once, tip from batch (or getLastSeq
 * only when empty). Caps entries; client re-syncs for the rest.
 */
export async function sendWelcomeFrame(args: {
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly fromSeq: number;
  readonly send: Sender;
  readonly roster: readonly RoomActor[];
}): Promise<void> {
  try {
    const all = await args.storage.loadEventsAfter(args.topic, args.fromSeq);
    const tip =
      all.length > 0
        ? all[all.length - 1]!.seq
        : await args.storage.getLastSeq(args.topic);
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

/** Fan-out; drop sockets whose `send` throws (never swallow). */
export function broadcastToConnections(
  connections: Map<string, { readonly id: string; readonly send: Sender }>,
  commandChains: Map<string, Promise<void>>,
  payload: unknown
): void {
  const dead: string[] = [];
  for (const conn of connections.values()) {
    try {
      conn.send(payload);
    } catch {
      dead.push(conn.id);
    }
  }
  for (const id of dead) {
    connections.delete(id);
    commandChains.delete(id);
  }
}
