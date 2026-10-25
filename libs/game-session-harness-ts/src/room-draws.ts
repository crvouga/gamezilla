import type { HarnessRoomNode } from '@libs/harness-ts/composition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { readCustomGameProbe } from './custom-game-probe';
import { harnessGameAt } from './harness-game-of';
import { isTurnHarnessGame } from './harness-game';

/**
 * Documented choices made through the room's injected random port: the
 * numbers the room's next random draws return, before it draws its own. A
 * scenario uses them for what a person cannot choose — which legal move a
 * bot makes, which deal a game with dealt hands starts from — and the room
 * then decides with them exactly as it would with any draw.
 */
const queues = new WeakMap<HarnessRoomNode, number[]>();

/** The room node's random port, drawing queued numbers first. */
export function queuedRandom(env: { readonly random: () => number }): {
  readonly random: () => number;
  readonly register: (node: HarnessRoomNode) => void;
} {
  const queue: number[] = [];
  return {
    random: () => queue.shift() ?? env.random(),
    register: (node) => queues.set(node, queue),
  };
}

/** Queue `draws` for the room's next random draws. */
export function queueRoomDraws(
  s: ProductHarness,
  draws: readonly number[]
): void {
  const queue = queues.get(s.harness.roomNode);
  if (queue === undefined)
    throw new Error('Room random choice was not injected');
  queue.splice(0, queue.length, ...draws);
}

/**
 * Before `actor`'s custom game starts: for a game with dealt hands, the
 * room deals the game's known deal (`fixtures.knownDeal`), the deal every
 * shared line is written for.
 */
export async function dealKnownHandsOnStart(
  s: ProductHarness,
  actor: string,
  operation: string
): Promise<void> {
  if (operation !== 'start') return;
  const current = (await readCustomGameProbe(s, actor))?.current;
  if (current === null || current === undefined) return;
  const game = harnessGameAt(s, current.fen);
  if (!isTurnHarnessGame(game)) return;
  const deal = game.fixtures.knownDeal;
  if (deal !== undefined) queueRoomDraws(s, deal.draws);
}
