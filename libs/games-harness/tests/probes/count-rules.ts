/**
 * The rules most probes vary: a count from zero to a finish, each action
 * counting on by its step. A probe says who moves next and who wins on
 * reaching the finish; everything else is ordinary `GameRules`, written
 * from the public game API alone. A position is `<id>:<count><w|b>`, the
 * side to move last.
 */

import type {
  GameRules,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared/game-rules';

export type CountGame = {
  readonly id: string;
  /** How far each action counts on. */
  readonly steps: Readonly<Record<string, number>>;
  readonly finish: number;
  /** A bounded one-person probe has no second side or positions for it. */
  readonly singlePlayer?: boolean;
  /** Who moves once `mover` has brought the count to `count`. */
  readonly next: (count: number, mover: GameSide) => GameSide;
  /** Who wins when `mover` reaches the finish, and the ending's reason. */
  readonly ending: (mover: GameSide) => {
    readonly winner: GameSide;
    readonly reason: string;
  };
};

export const otherSide = (side: GameSide): GameSide =>
  side === 'white' ? 'black' : 'white';

export function countRules(game: CountGame): GameRules {
  const pattern = new RegExp(`^${game.id}:(\\d+)([wb])$`);
  const parse = (position: string) => {
    const match = pattern.exec(position);
    const count = Number(match?.[1]);
    if (match === null || count > game.finish) return null;
    const mover: GameSide = match[2] === 'w' ? 'white' : 'black';
    if (game.singlePlayer && mover === 'black') return null;
    return { count, mover };
  };
  const show = (count: number, mover: GameSide) =>
    `${game.id}:${String(count)}${mover === 'white' ? 'w' : 'b'}`;
  const initial = show(0, 'white');
  const legal = (position: string): readonly string[] => {
    const at = parse(position);
    if (at === null || at.count >= game.finish) return [];
    return Object.keys(game.steps).filter(
      (action) => at.count + (game.steps[action] ?? 0) <= game.finish
    );
  };
  const play = (
    position: string,
    action: string,
    history: string
  ): PlayedPosition | null => {
    const at = parse(position);
    if (at === null || !legal(position).includes(action)) return null;
    const count = at.count + (game.steps[action] ?? 0);
    const ended = count === game.finish ? game.ending(at.mover) : null;
    const turn = game.next(count, at.mover);
    return {
      position: show(count, turn),
      history: history === '' ? action : `${history} ${action}`,
      turn,
      label: `${action} to ${String(count)}`,
      winner: ended?.winner ?? null,
      reason: ended?.reason ?? null,
    };
  };
  const trail = (actions: readonly string[]) => {
    const played: PlayedPosition[] = [];
    for (const action of actions) {
      const before = played.at(-1);
      const next = play(before?.position ?? initial, action, '');
      if (next === null) throw new Error(`${game.id}: ${action} is refused`);
      played.push(next);
    }
    return played;
  };
  return {
    id: game.id,
    recognizes: (position) => parse(position) !== null,
    initial: () => initial,
    play: (position, action, history) => play(position, action, history),
    replay: (actions, ply) =>
      trail(actions.slice(0, ply)).at(-1)?.position ?? initial,
    legal,
    canWin: (_position, side) => !game.singlePlayer || side === 'white',
    moves: (_position, _history, actions) =>
      trail(actions).map((played, ply, all) => ({
        label: played.label,
        before: all[ply - 1]?.position ?? initial,
        after: played.position,
      })),
  };
}
