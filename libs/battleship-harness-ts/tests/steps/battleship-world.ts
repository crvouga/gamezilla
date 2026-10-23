import {
  type BattleshipLineup,
  establishBattleship,
} from '@libs/battleship-harness-ts/battleship-actions';
import {
  type BattleshipView,
  battleshipView,
} from '@libs/battleship-harness-ts/battleship-view';
import {
  isShipId,
  type ShipId,
} from '@libs/battleship-shared-ts/battleship-board';
import type { Orientation } from '@libs/battleship-shared-ts/battleship-fleet';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

export type BattleshipWorld = Pick<HarnessWorld, 's' | 'memo'>;

const SETTLE_MS = 10_000;
const BEFORE = 'battleship-before';
const GAME = 'battleship-game';
const PLAYERS = ['alice', 'bob'] as const;

/** Both players' boards, kept to compare with after a refused choice. */
export async function remember(w: BattleshipWorld): Promise<void> {
  const views: Record<string, BattleshipView> = {};
  for (const player of PLAYERS) views[player] = await sees(w, player);
  w.memo.set(BEFORE, views);
}

export function remembered(w: BattleshipWorld, actor: string): BattleshipView {
  const views = w.memo.get(BEFORE) as
    | Record<string, BattleshipView>
    | undefined;
  const view = views?.[actor];
  if (view === undefined) throw new Error(`No earlier boards of ${actor}`);
  return view;
}

export async function setupBattleship(
  w: BattleshipWorld,
  lineup: BattleshipLineup = {}
): Promise<void> {
  await w.s.apply(establishBattleship, lineup);
  w.memo.set(GAME, true);
  await remember(w);
}

/** Both people seated, neither ready, unless the scenario already has its game. */
export async function setupPlacing(w: BattleshipWorld): Promise<void> {
  if (w.memo.get(GAME) === true) return;
  await setupBattleship(w, { ready: false, active: false });
}

export function sees(w: BattleshipWorld, actor: string) {
  return w.s.read(battleshipView, actor);
}

/** What `actor` sees once `pred` holds, within the time a sync takes. */
export function seesOnce(
  w: BattleshipWorld,
  actor: string,
  pred: (view: BattleshipView) => boolean
) {
  return w.s.until((s) => battleshipView(s, actor), {
    maxMs: SETTLE_MS,
    pred,
  });
}

/** A cell as the scenario names it (`C3`), as the board names it (`c3`). */
export function cellNamed(text: string): string {
  return text.toLowerCase();
}

/** Cells as the scenario lists them: `F1, G1, H1, I1 and J1`, `D5, F5 or E6`. */
export function cellsNamed(text: string): readonly string[] {
  return text.split(/, | and | or /).map(cellNamed);
}

export function shipNamed(text: string): ShipId {
  if (!isShipId(text)) throw new Error(`Unknown ship ${text}`);
  return text;
}

export function orientationNamed(text: string): Orientation {
  if (text === 'horizontally') return 'h';
  if (text === 'vertically') return 'v';
  throw new Error(`Unknown direction ${text}`);
}

/** The side `actor` plays, as their own screen shows it. */
export async function sideOf(w: BattleshipWorld, actor: string) {
  const side = (await sees(w, actor)).screen.mySide;
  if (side === null) throw new Error(`${actor} plays no side`);
  return side;
}
