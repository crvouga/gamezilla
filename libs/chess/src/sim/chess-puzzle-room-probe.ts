/**
 * A space member sends a host-only puzzle command straight to the space
 * room, over a connection of their own identity, the way a modified client
 * would. The watcher's UI never offers these (a watcher's drag is a
 * suggestion), so this is how a scenario proves that a watcher's command
 * changes nothing: the host alone drives the puzzle (§12, always-true:7).
 */

import { pollUntil, scenarioAction } from '@libs/sim-harness/system/actor-ui';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { readSpaceLink } from '@libs/spaces/sim/spaces-ui-reads';
import {
  newCommandId,
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  type RoomCommandPayload,
  type RoomError,
  WIRE_VERSION,
} from '@pkgs/room';
import {
  SkipChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from '../shared/chess/chess-puzzle-play-messages';
import { readPuzzleDebug } from './chess-puzzle-ui';

const WAIT_MS = 15_000;
const POLL_MS = 100;

export type HostPuzzleCommand = 'move' | 'skip';

/** What the room answered a member's command: refused (with why) or applied. */
type PuzzleCommandOutcome =
  | { readonly kind: 'refused'; readonly error: RoomError }
  | { readonly kind: 'applied' };

async function commandPayload(
  s: ProductSim,
  hostId: string,
  command: HostPuzzleCommand
): Promise<RoomCommandPayload> {
  if (command === 'skip') return SkipChessPuzzlePlay({});
  // The host's own next move: even the right move is not the watcher's.
  const debug = await readPuzzleDebug(s, hostId);
  const uci = debug?.solutionUci ?? '';
  if (uci.length < 4) {
    throw new Error(`${hostId} has no next move on the puzzle board`);
  }
  return SubmitChessPuzzleMove({ uci });
}

function spaceIdOfLink(link: string | null, hostId: string): string {
  const id = link?.slice('/space/'.length) ?? '';
  if (id.length === 0) throw new Error(`${hostId} is not in a space`);
  return id;
}

/**
 * `actorId` sends `command` for the puzzle `hostId` is playing, then waits
 * for the room's answer (refused or applied) before returning.
 */
export const attemptHostPuzzleCommand = scenarioAction({
  name: 'attemptHostPuzzleCommand',
  act: async (
    s,
    actorId: string,
    hostId: string,
    command: HostPuzzleCommand
  ) => {
    const spaceId = spaceIdOfLink(await readSpaceLink(s, hostId), hostId);
    const identity = await accountIdOf(s, actorId);
    if (identity === null) throw new Error(`${actorId} has no account`);
    const payload = await commandPayload(s, hostId, command);
    const env = await s.sim.client(actorId);
    const commandId = newCommandId(s.sim.server.createId);
    const frames: unknown[] = [];
    const transport = s.sim.roomNode.createTransport({
      spaceId,
      apiUrl: '',
      identity,
      installId: `${actorId}-room-probe`,
      clientId: `${actorId}-room-probe-${commandId}`,
      getSessionToken: () => null,
      timers: env.timers,
      random: env.random,
    });
    const unsubscribe = transport.subscribe((raw) => {
      frames.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    });
    try {
      await transport.connect();
      transport.sendJson({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.command,
        id: commandId,
        ts: s.sim.clock.now(),
        payload,
      });
      await pollUntil(s, () => Promise.resolve(answerTo(frames, commandId)), {
        maxMs: WAIT_MS,
        stepMs: POLL_MS,
        description: `room answer to ${actorId}'s ${command}`,
      });
    } finally {
      unsubscribe();
      transport.destroy();
    }
  },
});

function answerTo(
  frames: readonly unknown[],
  commandId: string
): PuzzleCommandOutcome | null {
  for (const raw of frames) {
    const frame = parseServerToClientWire(raw);
    if (frame === null) continue;
    if (
      frame.kind === ROOM_WIRE_KIND.rejected &&
      frame.commandId === commandId
    ) {
      return { kind: 'refused', error: frame.error };
    }
    if (
      frame.kind === ROOM_WIRE_KIND.committed &&
      frame.commandId === commandId
    ) {
      return { kind: 'applied' };
    }
  }
  return null;
}
