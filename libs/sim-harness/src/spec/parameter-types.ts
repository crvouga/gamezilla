/**
 * Parameter types every feature may use. Pure data: the spec check builds its
 * expression registry from this without booting anything.
 *
 * - `{actor}` — a person in the scenario (`Alice`, `Bob`, …), transformed to
 *   the actor id the sim uses. A signed-in actor's username is that id.
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
 *   `skipping it`, …), transformed to the chess sim's name for it.
 * - `{squares}` — chessboard squares as a list (`a2, a3 and b1`),
 *   transformed to the squares, sorted.
 * - `{device}` — one of a person's devices (`Alice's app`, `Alice's phone`,
 *   `Alice's tablet`), transformed to `{ actor, kind }`.
 * - `{deviceKind}` — `phone` or `tablet`.
 *
 * `@pkgs/sync-engine` cannot import this module (pkgs never import libs), so
 * its steps entry registers `{actor}` / `{device}` / `{deviceKind}` with the
 * same patterns; keep them in step.
 */

import type { ParameterTypeSpec } from '@pkgs/gherkin/registry';

export const ACTOR_IDS = {
  Alice: 'alice',
  Bob: 'bob',
  Carol: 'carol',
  Dave: 'dave',
  Eve: 'eve',
  White: 'white',
  Black: 'black',
} as const;

export type ActorName = keyof typeof ACTOR_IDS;
export type Actor = (typeof ACTOR_IDS)[ActorName];

export function actorId(name: string): Actor {
  const id = (ACTOR_IDS as Partial<Record<string, Actor>>)[name];
  if (id === undefined) {
    throw new Error(
      `unknown actor "${name}" (one of ${Object.keys(ACTOR_IDS).join(', ')})`
    );
  }
  return id;
}

/** How a scenario says a puzzle was finished, and the chess sim's name for it. */
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

export const SPEC_PARAMETER_TYPES: readonly ParameterTypeSpec[] = [
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
];
