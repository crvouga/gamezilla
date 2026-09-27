/**
 * Parameter types every feature may use. Pure data: the spec check builds its
 * expression registry from this without booting anything.
 *
 * - `{actor}` — a person in the scenario (`Alice`, `Bob`, …), transformed to
 *   the actor id the sim uses. A signed-in actor's username is that id.
 * - `{username}` — `@robert_1` → `robert_1`, a name someone picks or types.
 * - `{person}` — either of the above, as the object of a step (`shows Bob`,
 *   `shows @robert_1`), transformed to the username the UI displays.
 * - `{methods}` — the ways a person signs in (`Google`, `Apple`, or
 *   `Google and Apple`), transformed to the sorted provider ids
 *   (`['apple', 'google']`).
 */

import type { ParameterTypeSpec } from '@pkgs/gherkin/registry';

export const ACTOR_IDS = {
  Alice: 'alice',
  Bob: 'bob',
  Carol: 'carol',
  Dave: 'dave',
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
    name: 'methods',
    regexp: /Google and Apple|Google|Apple/,
    transformer: (text: string) =>
      text
        .split(' and ')
        .map((name) => name.toLowerCase())
        .sort(),
  },
];
