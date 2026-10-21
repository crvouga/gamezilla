import { MAX_WELCOME_ENTRIES_PER_FRAME } from '@pkgs/room-root-shared-ts/bounds';
import {
  entriesFor,
  hasPrivateEntries,
  type RoomAudience,
} from '@pkgs/room-root-shared-ts/private-events';
import {
  type RoomConnection,
  rejectedFrame,
} from '@pkgs/room-root-shared-ts/room-server-types';
import type {
  CommandDedupOutcome,
  RoomStorage,
} from '@pkgs/room-root-shared-ts/server-core-storage';
import type {
  LogEntry,
  RoomActor,
  RoomEvent,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';

type Sender = (payload: unknown) => void;

/** The entries as one connection may receive them (private events withheld). */
export type EntryView = (entries: readonly LogEntry[]) => readonly LogEntry[];

/** The entries as `conn`'s actor may read them under `module`'s audience. */
export function viewOf<E extends RoomEvent>(
  module: RoomAudience<E>,
  conn: RoomConnection
): EntryView {
  return (entries) =>
    entriesFor(module, entries as readonly LogEntry<E>[], conn.actor.id);
}

/**
 * A commit reaches every reader in one shared frame, unless it holds a
 * private event: then each reading connection gets its own copy, withheld
 * for it before it is serialized.
 */
export function sendCommitted<E extends RoomEvent>(args: {
  readonly connections: Map<string, RoomConnection>;
  readonly module: RoomAudience<E>;
  readonly commandId: string;
  readonly entries: readonly LogEntry<E>[];
  /** Whether a connection reads the room's history at all. */
  readonly reads: (connection: RoomConnection) => boolean;
}): void {
  const frame = (entries: readonly LogEntry[]) => ({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.committed,
    commandId: args.commandId,
    entries,
  });
  if (!hasPrivateEntries(args.module, args.entries)) {
    broadcastToConnections(args.connections, frame(args.entries), args.reads);
    return;
  }
  sendToEachConnection(
    args.connections,
    (conn) => frame(viewOf(args.module, conn)(args.entries)),
    args.reads
  );
}

/** Waiting connections receive availability without replacing retained history. */
export async function sendConnectionWelcome(args: {
  readonly connection: RoomConnection;
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly fromSeq: number;
  readonly roster: readonly RoomActor[];
  readonly available: () => boolean;
  readonly tip: () => Promise<number>;
  readonly view: EntryView;
}): Promise<void> {
  const connection = args.connection;
  if (connection.view.mode === 'presence' || !args.available()) {
    if (connection.view.mode === 'presence') {
      connection.send({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.welcome,
        fromSeq: 0,
        lastSeq: 0,
        entries: [],
      });
    }
    connection.send({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: args.roster,
    });
    return;
  }
  await sendWelcomeFrame({
    storage: args.storage,
    topic: args.topic,
    fromSeq: args.fromSeq,
    send: (frame) => {
      if (args.available()) connection.send(frame);
    },
    roster: args.roster,
    tip: args.tip,
    view: args.view,
  });
}

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
  readonly view: EntryView;
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
      entries: args.view(entries),
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
export function broadcastToConnections<
  T extends { readonly id: string; readonly send: Sender },
>(
  connections: Map<string, T>,
  payload: unknown,
  accepts: (connection: T) => boolean
): void {
  sendToEachConnection(connections, () => payload, accepts);
}

/**
 * One frame per connection, for entries some reader may not see: each
 * connection's copy withholds what it may not read before it is sent.
 */
export function sendToEachConnection<
  T extends { readonly id: string; readonly send: Sender },
>(
  connections: Map<string, T>,
  frameFor: (connection: T) => unknown,
  accepts: (connection: T) => boolean
): void {
  let dead: string[] | null = null;
  for (const conn of connections.values()) {
    if (!accepts(conn)) continue;
    try {
      conn.send(frameFor(conn));
    } catch {
      (dead ??= []).push(conn.id);
    }
  }
  if (dead !== null) {
    for (const id of dead) connections.delete(id);
  }
}

export function sendDedupReplay(
  send: RoomConnection['send'],
  commandId: string,
  prior: CommandDedupOutcome,
  view: EntryView
): void {
  if (prior.kind === 'committed') {
    send({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId,
      entries: view(prior.entries),
    });
  } else send(rejectedFrame(commandId, prior.error));
}
