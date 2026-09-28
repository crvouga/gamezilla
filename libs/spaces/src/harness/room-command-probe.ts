/**
 * One command sent to a space's room the way a device sends it: connect as
 * `identity` from `installId` (admitted with whatever grants the node's
 * gateway decides), send the command, and wait for the room's answer.
 */

import type { HarnessRoomNode } from '@libs/harness/composition';
import type { Timers } from '@pkgs/clock';
import type { Message } from '@pkgs/message';
import { ROOM_WIRE_KIND, type RoomError, WIRE_VERSION } from '@pkgs/room';

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

/** The room's answer to `payload`; the room answers without timers. */
export async function answerOfRoomCommand(
  node: HarnessRoomNode,
  args: {
    readonly spaceId: string;
    readonly identity: string;
    readonly installId: string;
    readonly payload: Message;
    readonly nowMs: number;
    readonly timers: Timers;
  }
): Promise<RoomAnswer> {
  const commandId = `${args.identity}-command`;
  const frames: Frame[] = [];
  const transport = node.createTransport({
    spaceId: args.spaceId,
    apiUrl: '',
    identity: args.identity,
    installId: args.installId,
    clientId: `${args.identity}-probe`,
    getSessionToken: () => null,
    timers: args.timers,
    random: () => 0.5,
  });
  transport.subscribe((raw) => {
    frames.push((typeof raw === 'string' ? JSON.parse(raw) : raw) as Frame);
  });
  try {
    await transport.connect();
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
    transport.destroy();
  }
}
