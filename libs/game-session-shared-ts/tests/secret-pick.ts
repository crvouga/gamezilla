import type {
  GameBots,
  GameRules,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * The smallest game with private setups: each side hides a number from one
 * to nine, then the sides take turns guessing the other's. A guess is told
 * "higher", "lower" or found, and finding it wins. A guess is proposed as
 * `g<n>`; the room records it as `g<n>:higher`, `g<n>:lower` or `g<n>:found`.
 */

const PREFIX = 'pick:';
const GUESSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const OUTCOMES = ['higher', 'lower', 'found'] as const;

type Guess = { readonly n: number; readonly outcome: string };

function parse(action: string): Guess | null {
  const match = /^g([1-9]):(higher|lower|found)$/.exec(action);
  return match === null ? null : { n: Number(match[1]), outcome: match[2]! };
}

function actionsOf(position: string): readonly string[] | null {
  if (!position.startsWith(PREFIX)) return null;
  const body = position.slice(PREFIX.length);
  return body === '' ? [] : body.split(',');
}

function moverAt(ply: number): GameSide {
  return ply % 2 === 0 ? 'white' : 'black';
}

function guessedBy(actions: readonly string[], side: GameSide): number[] {
  return actions
    .filter((_, i) => moverAt(i) === side)
    .map((a) => parse(a)?.n ?? 0);
}

function over(actions: readonly string[]): boolean {
  return actions.some((a) => parse(a)?.outcome === 'found');
}

function step(
  actions: readonly string[],
  action: string
): PlayedPosition | null {
  const guess = parse(action);
  const mover = moverAt(actions.length);
  if (guess === null || over(actions)) return null;
  if (guessedBy(actions, mover).includes(guess.n)) return null;
  const next = [...actions, action];
  const found = guess.outcome === 'found';
  return {
    position: PREFIX + next.join(','),
    history: next.join(','),
    turn: moverAt(next.length),
    label: `${String(guess.n)} ${guess.outcome}`,
    winner: found ? mover : null,
    reason: found ? 'found' : null,
  };
}

function replay(actions: readonly string[], ply: number): string {
  return PREFIX + actions.slice(0, ply).join(',');
}

export const secretPickRules: GameRules = {
  id: 'secret-pick',
  recognizes: (position) => {
    const actions = actionsOf(position);
    if (actions === null) return false;
    let played: readonly string[] = [];
    for (const action of actions) {
      if (step(played, action) === null) return false;
      played = [...played, action];
    }
    return true;
  },
  initial: () => PREFIX,
  play: (position, action) => step(actionsOf(position) ?? [], action),
  replay,
  legal: (position) => {
    const actions = actionsOf(position) ?? [];
    if (over(actions)) return [];
    const taken = guessedBy(actions, moverAt(actions.length));
    return GUESSES.filter((n) => !taken.includes(Number(n))).map(
      (n) => `g${n}`
    );
  },
  canWin: (position) => !over(actionsOf(position) ?? []),
  moves: (_position, _history, actions) =>
    actions.map((action, i) => ({
      label: step(actions.slice(0, i), action)?.label ?? action,
      before: replay(actions, i),
      after: replay(actions, i + 1),
    })),
  setup: {
    accept: (setup) => (/^n[1-9]$/.test(setup) ? setup : null),
    random: (random) => `n${String(1 + Math.floor(random() * 9))}`,
    resolve: (position, proposal, setups) => {
      const actions = actionsOf(position);
      if (actions === null) return null;
      if (!secretPickRules.legal(position).includes(proposal)) return null;
      const defender = moverAt(actions.length) === 'white' ? 'black' : 'white';
      const hidden = Number(setups[defender].slice(1));
      const n = Number(proposal.slice(1));
      const outcome = OUTCOMES[n === hidden ? 2 : hidden > n ? 0 : 1];
      return `${proposal}:${outcome}`;
    },
  },
};

export const secretPickBots: GameBots = {
  difficulties: [],
  choose: (position, _difficulty, random) => {
    const legal = secretPickRules.legal(position);
    return legal.length === 0
      ? null
      : (legal[Math.floor(random() * legal.length)] ?? null);
  },
};
