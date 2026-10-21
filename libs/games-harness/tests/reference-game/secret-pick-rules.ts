/**
 * The rules of the test-only private-setup consumer: each side hides a
 * number from two to nine (so a first guess of one never wins at once), then the sides take turns guessing the other's.
 * A guess is proposed as `g<n>`; the authority answers it with both hidden
 * numbers as `g<n>:higher`, `g<n>:lower` or `g<n>:found`, and finding the
 * number wins. A position (`pick:` and the answered guesses) holds no hidden
 * number. Written only for the shared suites, never shipped.
 */

import type {
  GameBots,
  GameRecordMetadata,
  GameRules,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared/game-rules';

const PREFIX = 'pick:';
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

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

const moverAt = (ply: number): GameSide => (ply % 2 === 0 ? 'white' : 'black');

function guessedBy(actions: readonly string[], side: GameSide): number[] {
  return actions
    .filter((_, i) => moverAt(i) === side)
    .map((a) => parse(a)?.n ?? 0);
}

const over = (actions: readonly string[]) =>
  actions.some((a) => parse(a)?.outcome === 'found');

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

const replay = (actions: readonly string[], ply: number) =>
  PREFIX + actions.slice(0, ply).join(',');

function legal(position: string): readonly string[] {
  const actions = actionsOf(position) ?? [];
  if (over(actions)) return [];
  const taken = guessedBy(actions, moverAt(actions.length));
  return NUMBERS.filter((n) => !taken.includes(Number(n))).map((n) => `g${n}`);
}

function recognizes(position: string): boolean {
  const actions = actionsOf(position);
  if (actions === null) return false;
  let played: readonly string[] = [];
  for (const action of actions) {
    if (step(played, action) === null) return false;
    played = [...played, action];
  }
  return true;
}

export const SECRET_PICK_RULES: GameRules = {
  id: 'secret-pick',
  recognizes,
  initial: () => PREFIX,
  play: (position, action) => step(actionsOf(position) ?? [], action),
  replay,
  legal,
  canWin: (position) => !over(actionsOf(position) ?? []),
  // The position holds every guess so far, as a matched game's list reads it.
  moves: (position, _history, actions) => {
    const played = actionsOf(position) ?? actions;
    return played.map((action, i) => ({
      label: step(played.slice(0, i), action)?.label ?? action,
      before: replay(played, i),
      after: replay(played, i + 1),
    }));
  },
  setup: {
    accept: (setup) => (/^n[2-9]$/.test(setup) ? setup : null),
    random: (random) => `n${String(2 + Math.floor(random() * 8))}`,
    resolve: (position, proposal, setups) => {
      const actions = actionsOf(position);
      if (actions === null || !legal(position).includes(proposal)) return null;
      const defender = moverAt(actions.length) === 'white' ? 'black' : 'white';
      const hidden = Number(setups[defender].slice(1));
      const n = Number(proposal.slice(1));
      if (n === hidden) return `${proposal}:found`;
      return `${proposal}:${hidden > n ? 'higher' : 'lower'}`;
    },
  },
};

/** A guess the public answers so far still allow, else any untried one. */
function narrowed(position: string): readonly string[] {
  const actions = actionsOf(position) ?? [];
  const mine = actions.filter((_, i) => moverAt(i) === moverAt(actions.length));
  let low = 1;
  let high = 9;
  for (const action of mine) {
    const guess = parse(action);
    if (guess?.outcome === 'higher') low = Math.max(low, guess.n + 1);
    if (guess?.outcome === 'lower') high = Math.min(high, guess.n - 1);
  }
  const open = legal(position);
  const inRange = open.filter((g) => {
    const n = Number(g.slice(1));
    return n >= low && n <= high;
  });
  return inRange.length > 0 ? inRange : open;
}

export const SECRET_PICK_BOTS: GameBots = {
  difficulties: [],
  choose: (position, _difficulty, random) => {
    const options = narrowed(position);
    return options.length === 0
      ? null
      : (options[Math.floor(random() * options.length)] ?? null);
  },
};

/** The downloadable record: both people, the result, the clock and each answered guess. */
export function secretPickRecord(
  position: string,
  _history: string,
  metadata: GameRecordMetadata
): string {
  const actions = actionsOf(position) ?? [];
  return JSON.stringify({
    game: 'secret-pick',
    metadata,
    guesses: actions.map((a, i) => step(actions.slice(0, i), a)?.label ?? a),
  });
}
