/**
 * One command sent to a space's room the way a device sends it: connect as
 * `identity` from `installId` (admitted with whatever grants the node's
 * gateway decides), send the command, and wait for the room's answer.
 */

import type { HarnessRoomNode } from '@libs/harness-ts/composition';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import type { RoomError } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';

export type RoomAnswer =
  | { readonly kind: 'committed' }
  | { readonly kind: 'rejected'; readonly error: RoomError };

type Frame = {
  readonly kind?: unknown;
  readonly commandId?: unknown;
  readonly error?: RoomError;
};

function answerIn(frames: readonly Frame[], id: string): RoomAnswer | null {
  for (const frame of frames) {
    if (frame.commandId !== id) continue;
    if (frame.kind === ROOM_WIRE_KIND.committed) return { kind: 'committed' };
    if (frame.kind === ROOM_WIRE_KIND.rejected && frame.error !== undefined) {
      return { kind: 'rejected', error: frame.error };
    }
  }
  return null;
}

/** A device's connection to a space's room, kept open across many commands. */
export type RoomCommandProbe = {
  /** The room's answer to `payload`; the room answers without timers. */
  readonly send: (command: {
    readonly payload: Message;
    readonly commandId: string;
    readonly nowMs: number;
  }) => Promise<RoomAnswer>;
  readonly close: () => void;
};

/**
 * Connect as `identity` from `installId` once and send commands through the
 * one connection, as a device does; `null` when the room refuses the person.
 */
export async function openRoomCommandProbe(
  node: HarnessRoomNode,
  args: {
    readonly spaceId: string;
    readonly identity: string;
    readonly installId: string;
    readonly clientId: string;
    readonly clock: Clock;
    readonly timers: Timers;
  }
): Promise<RoomCommandProbe | null> {
  const frames: Frame[] = [];
  const transport = node.createTransport({
    topic: `space:${args.spaceId}`,
    module: 'space',
    apiUrl: '',
    identity: args.identity,
    installId: args.installId,
    clientId: `${args.clientId}-probe`,
    getSessionToken: () => null,
    clock: args.clock,
    timers: args.timers,
    random: () => 0.5,
  });
  transport.subscribe((raw) => {
    frames.push((typeof raw === 'string' ? JSON.parse(raw) : raw) as Frame);
  });
  try {
    await transport.connect();
  } catch (cause) {
    transport.destroy();
    if (!(cause instanceof Error) || cause.message !== 'not in the space')
      throw cause;
    return null;
  }
  return {
    send: async (command) => {
      transport.sendJson({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.command,
        id: command.commandId,
        ts: command.nowMs,
        payload: command.payload,
      });
      for (let turn = 0; turn < 1_000; turn += 1) {
        const answer = answerIn(frames, command.commandId);
        if (answer !== null) {
          frames.length = 0;
          return answer;
        }
        await Promise.resolve();
      }
      throw new Error('the space room never answered the command');
    },
    close: () => transport.destroy(),
  };
}

/** The room's answer to `payload`; the room answers without timers. */
export async function answerOfRoomCommand(
  node: HarnessRoomNode,
  args: {
    readonly spaceId: string;
    readonly identity: string;
    readonly installId: string;
    readonly payload: Message;
    readonly commandId: string;
    readonly nowMs: number;
    readonly clock: Clock;
    readonly timers: Timers;
    /** An already owned connection, kept open between a scenario's choices. */
    readonly transport?: ClientTransport;
    readonly beforeSend?: () => Promise<void>;
  }
): Promise<RoomAnswer> {
  const commandId = args.commandId;
  const frames: Frame[] = [];
  const transport =
    args.transport ??
    node.createTransport({
      topic: `space:${args.spaceId}`,
      module: 'space',
      apiUrl: '',
      identity: args.identity,
      installId: args.installId,
      clientId: `${commandId}-probe`,
      getSessionToken: () => null,
      clock: args.clock,
      timers: args.timers,
      random: () => 0.5,
    });
  const unsubscribe = transport.subscribe((raw) => {
    frames.push((typeof raw === 'string' ? JSON.parse(raw) : raw) as Frame);
  });
  try {
    try {
      if (!transport.isConnected) await transport.connect();
    } catch (cause) {
      if (!(cause instanceof Error) || cause.message !== 'not in the space')
        throw cause;
      return {
        kind: 'rejected',
        error: { type: ROOM_ERROR_TYPE.unauthorized, reason: cause.message },
      };
    }
    await args.beforeSend?.();
    transport.sendJson({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.command,
      id: commandId,
      ts: args.nowMs,
      payload: args.payload,
    });
    for (let turn = 0; turn < 1_000; turn += 1) {
      const answer = answerIn(frames, commandId);
      if (answer !== null) return answer;
      await Promise.resolve();
    }
    throw new Error('the space room never answered the command');
  } finally {
    unsubscribe();
    if (args.transport === undefined) transport.destroy();
  }
}
