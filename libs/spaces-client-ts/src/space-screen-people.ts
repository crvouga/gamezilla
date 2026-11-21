/**
 * The people row of a space screen, from who the space counts as present:
 * pure, so every combination is checked without a space.
 */

import { avatarInitials } from '@pkgs/ui-root-client-ts/avatar';
import type { SpacePerson as SpaceShellPerson } from '@pkgs/ui-root-client-ts/space-types';

/** One person the space counts as present, as the people row needs them. */
export type SpaceScreenFace = {
  /** Profile id. */
  readonly id: string;
  /** Shown name, or null before their profile syncs. */
  readonly name: string | null;
  /** Their avatar art, when they have one. */
  readonly svg: string | undefined;
};

export type SpaceScreenPeopleInput = {
  readonly faces: readonly SpaceScreenFace[];
  readonly hostId: string | null;
  readonly myId: string;
  /** People whose every device in the space has gone quiet. */
  readonly idle: ReadonlySet<string>;
};

/**
 * Each present person as a people-row cell: the host first, then everyone
 * else in the order the space counts them; the viewer marked `you`, the
 * host `host`, and a quiet person `away`.
 */
export function spaceScreenPeople(
  input: SpaceScreenPeopleInput
): readonly SpaceShellPerson[] {
  const people = input.faces.map((face): SpaceShellPerson => {
    const name = face.name ?? '';
    const initials = avatarInitials(name);
    return {
      id: face.id,
      kind: 'person',
      name,
      you: face.id === input.myId,
      host: face.id === input.hostId,
      status: input.idle.has(face.id) ? 'away' : undefined,
      initials: initials.length > 0 ? initials : undefined,
      tintKey: face.id,
      svg: face.svg,
    };
  });
  return [
    ...people.filter((person) => person.host === true),
    ...people.filter((person) => person.host !== true),
  ];
}
