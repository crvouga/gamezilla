import {
  type BattleshipView,
  battleshipView,
} from '@libs/battleship-harness-ts/battleship-view';
import { CELLS } from '@libs/battleship-shared-ts/battleship-board';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';

/** The models' players: 1 is Alice (the first fleet), 2 is Bob. */
export const PLAYERS = { 1: 'alice', 2: 'bob' } as const;
export type Player = keyof typeof PLAYERS;
export const SIDES = { 1: 'white', 2: 'black' } as const;
/**
 * Alice hosts the space and creates the game, as only a host may; Carol
 * watches it, connected throughout, and her screen shows every shot and
 * readiness as they are.
 */
export const WATCHER = 'carol';

const PHASES = {
  configuring: 'setup',
  active: 'shooting',
  completed: 'over',
} as const;

/** The model's cell number as the board names the cell (0 is A1, 99 is J10). */
export function cellOf(index: number): string | null {
  return CELLS[index] ?? null;
}

export function player(picks: Record<string, QuintValue>): Player {
  const p = Number(picks['p']);
  if (p !== 1 && p !== 2) throw new Error(`No player ${String(p)}`);
  return p;
}

export function sideNumber(side: string | undefined): number {
  return side === 'white' ? 1 : side === 'black' ? 2 : 0;
}

export const byPlayer = <T extends QuintValue>(read: (p: Player) => T) =>
  new Map<QuintValue, QuintValue>([
    [1, read(1)],
    [2, read(2)],
  ]);

/** The game as Carol watches it, and as each player sees it. */
export async function watchGame(w: QuintHarnessWorld) {
  const watched = await w.s.read(battleshipView, WATCHER);
  const seen: Record<Player, BattleshipView> = {
    1: await w.s.read(battleshipView, PLAYERS[1]),
    2: await w.s.read(battleshipView, PLAYERS[2]),
  };
  const game = watched.screen.current;
  if (game === null) throw new Error('Carol sees no game');
  return {
    watched,
    seen,
    game,
    phase: PHASES[game.status as keyof typeof PHASES],
    winner: sideNumber(/^(white|black) wins/.exec(game.outcome)?.[1]),
  };
}
