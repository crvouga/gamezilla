/**
 * A space member sends a host-only puzzle command straight to the space
 * room, over a connection of their own identity, the way a modified client
 * would. The watcher's UI never offers these (a watcher's drag is a
 * suggestion), so this is how a scenario proves that a watcher's command
 * changes nothing: the host alone drives the puzzle (§12, always-true:7).
 */

import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { newCommandId } from '@pkgs/room-root-shared-ts/ids';
import type {
  RoomCommandPayload,
  RoomError,
} from '@pkgs/room-root-shared-ts/types';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared-ts/wire';
import { readPuzzleProbe } from './puzzle-screen';
import {
  puzzleSessionCommand,
  readPuzzleSession,
} from './puzzle-session-probe';

const WAIT_MS = 15_000;
const POLL_MS = 100;

export type HostPuzzleCommand =
  | 'move'
  | 'skip'
  | 'hint'
  | 'show-line'
  | 'solution'
  | 'step'
  | 'illegal';

/** What the room answered a member's command: refused (with why) or applied. */
type PuzzleCommandOutcome =
  | { readonly kind: 'refused'; readonly error: RoomError }
  | { readonly kind: 'applied' };

const replies = new WeakMap<ProductHarness, PuzzleCommandOutcome>();
export function readLastPuzzleCommandOutcome(s: ProductHarness) {
  const reply = replies.get(s);
  if (reply === undefined) throw new Error('No puzzle command answer');
  return reply;
}

/** Translate the room's refusal into the reason visible in the product contract. */
export function readLastPuzzleRefusal(s: ProductHarness): string | null {
  const reply = readLastPuzzleCommandOutcome(s);
  if (reply.kind !== 'refused') return null;
  if (!('reason' in reply.error)) return String(reply.error.type);
  const reason = reply.error.reason;
  if (reason === 'cannot step while status is skipped')
    return 'the puzzle was skipped';
  if (/status is (solved|revealed|skipped)/.test(reason))
    return 'the puzzle is over';
  if (reason.includes('current position'))
    return 'they are reviewing an earlier position';
  if (reason.includes('status is wrong')) return 'a retry is needed';
  if (reason.includes('first hint is already'))
    return 'the first hint is already taken';
  if (reason.includes('first hint before')) return 'the first hint is needed';
  return reason;
}

/** An action no game's rules know: never a move. */
const NO_MOVE = 'no-such-move';

async function commandPayload(
  s: ProductHarness,
  hostId: string,
  command: HostPuzzleCommand
): Promise<RoomCommandPayload> {
  if (command === 'illegal')
    return puzzleSessionCommand({ kind: 'move', action: NO_MOVE });
  if (command !== 'move') return puzzleSessionCommand({ kind: command });
  // The host's own next move: even the right move is not the watcher's.
  // A puzzle that is over has none: any move is refused there alike.
  const next = (await readPuzzleProbe(s, hostId))?.next ?? '';
  return puzzleSessionCommand({
    kind: 'move',
    action: next.length > 0 ? next : NO_MOVE,
  });
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
    const state = s.harness.roomNode.inspect(
      `space:${spaceId}`
    )?.committedState;
    const identity =
      actorId === hostId && state !== undefined
        ? readPuzzleSession(state).hostIdentity
        : await accountIdOf(s, actorId);
    if (identity === null) throw new Error(`${actorId} has no account`);
    const payload = await commandPayload(s, hostId, command);
    const env = await s.harness.client(actorId);
    const commandId = newCommandId(s.harness.server.createId);
    const frames: unknown[] = [];
    const transport = s.harness.roomNode.createTransport({
      topic: `space:${spaceId}`,
      module: 'space',
      apiUrl: '',
      identity,
      installId: `${actorId}-room-probe`,
      clientId: `${actorId}-room-probe-${commandId}`,
      getSessionToken: () => null,
      clock: env.clock,
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
        ts: s.harness.clock.now(),
        payload,
      });
      const reply = await pollUntil(
        s,
        () => Promise.resolve(answerTo(frames, commandId)),
        {
          maxMs: WAIT_MS,
          stepMs: POLL_MS,
          description: `room answer to ${actorId}'s ${command}`,
        }
      );
      replies.set(s, reply);
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

export const PUZZLE_ROOM_PROBE_ACTIONS = [attemptHostPuzzleCommand];
