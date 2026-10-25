/**
 * Parameter types every sub may use. Pure data: the spec check builds its
 * expression registry from this without booting anything.
 *
 * - `{actor}` — a person in the scenario (`Alice`, `Bob`, …), transformed to
 *   the actor id the harness uses. A signed-in actor's username is that id.
 * - `{username}` — `@robert_1` → `robert_1`, a name someone picks or types.
 * - `{person}` — either of the above, as the object of a step (`shows Bob`,
 *   `shows @robert_1`), transformed to the username the UI displays.
 * - `{provider}` — one way a person signs in (`Google` or `Apple`),
 *   transformed to its provider id (`google`, `apple`).
 * - `{methods}` — the ways a person signs in (`Google`, `Apple`, or
 *   `Google and Apple`), transformed to the sorted provider ids
 *   (`['apple', 'google']`).
 * - `{direction}` — `back` or `forward`, one step through a line.
 * - `{end}` — `start` or `end` of a line.
 * - `{finish}` — how a player finishes a puzzle (`solving it cleanly`,
 *   `skipping it`, …), transformed to the chess harness's name for it.
 * - `{squares}` — chessboard squares as a list (`a2, a3 and b1`),
 *   transformed to the squares, sorted.
 * - `{device}` — one of a person's devices (`Alice's app`, `Alice's phone`,
 *   `Alice's tablet`), transformed to `{ actor, kind }`.
 * - `{deviceKind}` — `phone` or `tablet`.
 * - `{gameSide}` — `first side` or `second side` of any game, transformed to
 *   its seat (`white`, `black`).
 * - `{tiles}`, `{tileWord}`, `{boardSquare}`, `{wordSpan}`,
 *   `{tilePlacements}`, `{wordTilesRefusal}` — Word Tiles' tiles (as
 *   letters, a blank as `?`), words, squares, words where they lie, tiles
 *   put on squares and refusals.
 *
 * `@pkgs/sync-engine` cannot import this module (pkgs never import libs), so
 * its steps entry registers `{actor}` / `{device}` / `{deviceKind}` with the
 * same patterns; keep them in step.
 */

import type { ParameterTypeSpec } from '@pkgs/gherkin-shared-ts/registry';

export const ACTOR_IDS = {
  Alice: 'alice',
  Bob: 'bob',
  Carol: 'carol',
  Dave: 'dave',
  Eve: 'eve',
  White: 'white',
  Black: 'black',
  Cedar: 'cedar',
} as const;

export type ActorName = keyof typeof ACTOR_IDS;
export type Actor = (typeof ACTOR_IDS)[ActorName];

export const PUZZLE_POSITIONS = {
  'the start': 'start',
  'the start of the puzzle': 'start',
  'the end of the line': 'end',
  'the position before the last move': 'before-last',
  'the first move of the line': 'first',
} as const;
export type PuzzleLinePoint =
  | (typeof PUZZLE_POSITIONS)[keyof typeof PUZZLE_POSITIONS]
  | 'continuation';

export function actorId(name: string): Actor {
  const id = (ACTOR_IDS as Partial<Record<string, Actor>>)[name];
  if (id === undefined) {
    throw new Error(
      `unknown actor "${name}" (one of ${Object.keys(ACTOR_IDS).join(', ')})`
    );
  }
  return id;
}

/** How a scenario says a puzzle was finished, and the chess harness's name for it. */
export const PUZZLE_FINISHES = {
  'solving it cleanly': 'clean',
  'taking a hint, then solving it': 'hintThenSolve',
  'playing a wrong move, retrying, then solving it': 'wrongRetrySolve',
  'showing the solution': 'showSolution',
  'skipping it': 'skip',
} as const;

export type PuzzleFinishName =
  (typeof PUZZLE_FINISHES)[keyof typeof PUZZLE_FINISHES];

export function puzzleFinish(text: string): PuzzleFinishName {
  const finish = (PUZZLE_FINISHES as Partial<Record<string, PuzzleFinishName>>)[
    text
  ];
  if (finish === undefined) throw new Error(`no way to finish by "${text}"`);
  return finish;
}

export const PARAMETER_TYPES: readonly ParameterTypeSpec[] = [
  {
    name: 'puzzleAnimation',
    regexp: /with animation|without animation/,
    transformer: (text: string) => text === 'with animation',
  },
  {
    name: 'puzzleProgress',
    regexp: /before|after/,
    transformer: (text: string) =>
      text === 'before' ? 'start' : 'continuation',
  },
  {
    name: 'puzzlePosition',
    regexp: new RegExp(Object.keys(PUZZLE_POSITIONS).join('|')),
    transformer: (text: string) =>
      PUZZLE_POSITIONS[text as keyof typeof PUZZLE_POSITIONS],
  },
  {
    name: 'usernameRefusal',
    regexp:
      /it is shorter than 3 characters|it is longer than 32 characters|it contains characters other than letters, numbers and _|the name is not allowed|their username was changed recently|their device is offline|another person already has that name/,
    transformer: (text: string) => text,
  },
  {
    name: 'competingFinish',
    regexp: /clean solve|wrong then solve/,
    transformer: (text: string) =>
      text === 'clean solve' ? 'clean' : 'wrongRetrySolve',
  },
  {
    name: 'puzzleCommandAttempt',
    regexp:
      /tries another move after finishing|tries another move before retrying|tries to show the solution after finishing|tries to take a hint after finishing|tries to skip after finishing|tries a move from that earlier position|tries a hint from that earlier position|tries to take a hint before retrying|tries to see the solution move before a hint|tries the first hint again|tries to review an earlier puzzle position/,
    transformer: (text: string) =>
      text.includes('show the solution')
        ? 'show-line'
        : text.includes('review')
          ? 'step'
          : text.includes('solution')
            ? 'solution'
            : text.includes('hint')
              ? 'hint'
              : text.includes('skip')
                ? 'skip'
                : 'move',
  },
  {
    name: 'puzzleRefusal',
    regexp:
      /the puzzle is over|they are reviewing an earlier position|a retry is needed|the first hint is needed|the first hint is already taken|the puzzle was skipped/,
    transformer: (text: string) => text,
  },
  {
    name: 'feedbackDetail',
    regexp:
      /what happened|what was expected|reproduction steps|a description|an improvement/,
    transformer: (value: string) => value,
  },
  {
    name: 'feedbackKind',
    regexp: /a feature request|a gap|polish/,
    transformer: (value: string) => value,
  },
  {
    name: 'actor',
    regexp: new RegExp(Object.keys(ACTOR_IDS).join('|')),
    transformer: (name: string) => actorId(name),
  },
  {
    name: 'username',
    regexp: /@[a-z0-9_]+/,
    transformer: (text: string) => text.slice(1),
  },
  {
    name: 'person',
    regexp: new RegExp(`${Object.keys(ACTOR_IDS).join('|')}|@[a-z0-9_]+`),
    transformer: (text: string) =>
      text.startsWith('@') ? text.slice(1) : actorId(text),
  },
  {
    name: 'provider',
    regexp: /Google|Apple/,
    transformer: (text: string) => text.toLowerCase(),
  },
  {
    name: 'methods',
    regexp: /Google and Apple|Google|Apple/,
    transformer: (text: string) =>
      text
        .split(' and ')
        .map((name) => name.toLowerCase())
        .sort(),
  },
  {
    name: 'direction',
    regexp: /back|forward/,
    transformer: (text: string) => text,
  },
  {
    name: 'end',
    regexp: /start|end/,
    transformer: (text: string) => text,
  },
  {
    name: 'device',
    regexp: new RegExp(
      `(?:${Object.keys(ACTOR_IDS).join('|')})'s (?:app|phone|tablet)`
    ),
    transformer: (text: string) => {
      const [name = '', kind = ''] = text.split("'s ");
      return { actor: actorId(name), kind };
    },
  },
  {
    name: 'deviceKind',
    regexp: /phone|tablet/,
    transformer: (text: string) => text,
  },
  {
    name: 'finish',
    regexp: new RegExp(Object.keys(PUZZLE_FINISHES).join('|')),
    transformer: (text: string) => puzzleFinish(text),
  },
  {
    name: 'squares',
    regexp: /[a-h][1-8](?:(?:, | and )[a-h][1-8])*/,
    transformer: (text: string) => text.split(/, | and /).sort(),
  },
  {
    // "1450, 1650 and 1900": puzzle ratings, in the order written.
    name: 'ratings',
    regexp: /\d{3,4}(?:(?:, | and )\d{3,4})+/,
    transformer: (text: string) =>
      text.split(/, | and /).map((rating) => Number.parseInt(rating, 10)),
  },
  {
    name: 'chessSide',
    regexp: /White|Black/,
    transformer: (text: string) => text,
  },
  {
    name: 'chessPiece',
    regexp: /pawn|knight|bishop|rook|queen|king/,
    transformer: (text: string) => text,
  },
  {
    name: 'fourDirection',
    regexp: /horizontal|vertical|ascending diagonal|descending diagonal/,
    transformer: (text: string) => text,
  },
  {
    name: 'gameSide',
    regexp: /first side|second side/,
    transformer: (text: string) => (text === 'first side' ? 'white' : 'black'),
  },
  {
    name: 'gameParticipants',
    regexp:
      /two ready people|a ready person on the first side and a bot on the second side|a bot on the first side and a ready person on the second side|two bots/,
    transformer: (text: string) => text,
  },
  {
    // Word Tiles: "C, A, T and a blank", "Q and Z", "seven E tiles" — the
    // tiles' letters, a blank as "?".
    name: 'tiles',
    regexp:
      /seven [A-Z] tiles|(?:[A-Z]|a blank)(?:(?:, | and )(?:[A-Z]|a blank))*/,
    transformer: (text: string) =>
      text.startsWith('seven ')
        ? (text[6] ?? '').repeat(7)
        : text
            .split(/, | and /)
            .map((tile) => (tile === 'a blank' ? '?' : tile))
            .join(''),
  },
  {
    // A Word Tiles word as the board shows it: "CAT", "RETAINS".
    name: 'tileWord',
    regexp: /[A-Z]{2,15}/,
    transformer: (text: string) => text,
  },
  {
    // A Word Tiles square: columns a to o, rows 1 to 15.
    name: 'boardSquare',
    regexp: /[a-o](?:1[0-5]|[1-9])/,
    transformer: (text: string) => text,
  },
  {
    // A Word Tiles word and where it lies: "CAT from g8 to i8".
    name: 'wordSpan',
    regexp: /[A-Z]{2,15} from [a-o](?:1[0-5]|[1-9]) to [a-o](?:1[0-5]|[1-9])/,
    transformer: (text: string) => {
      const [word = '', , from = '', , to = ''] = text.split(' ');
      return { word, from, to };
    },
  },
  {
    // Word Tiles tiles put on squares: "C on g7 and A on h8", "S on h9".
    name: 'tilePlacements',
    regexp:
      /[A-Z] on [a-o](?:1[0-5]|[1-9])(?: and [A-Z] on [a-o](?:1[0-5]|[1-9]))*/,
    transformer: (text: string) =>
      text.split(' and ').map((entry) => {
        const [letter = '', , square = ''] = entry.split(' ');
        return { letter, square };
      }),
  },
  {
    // What a Word Tiles player is told when a turn is refused.
    name: 'wordTilesRefusal',
    regexp:
      /her first word must cover the centre square|her word must join the tiles on the board|her tiles must lie in one line|the bag holds too few tiles to exchange|it is not his turn|the game is over|he does not hold those tiles|her placement does not reach the target/,
    transformer: (text: string) => text,
  },
];
