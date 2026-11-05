/**
 * Where the space's bar says the person is, and which named place its one
 * way back leads to. Framework-free so it unit-tests bare.
 */

/** A place in the trail: where the person is, the way back, or neither. */
export type SpaceTrailRole = 'current' | 'parent' | 'ancestor';

export type SpaceTrail = {
  /** The room (the space's list of games). */
  readonly room: SpaceTrailRole;
  /** The selected game, while one is chosen; else `null`. */
  readonly place: SpaceTrailRole | null;
};

export type SpaceTrailInput = {
  /** The selected game's name; `undefined` on the space's list of games. */
  readonly place: string | undefined;
  /** The screen registered a way back. */
  readonly hasBack: boolean;
  /** Where that way back goes, when the screen named it ("Games", "Chess"). */
  readonly backLabel: string | undefined;
};

/**
 * The room, then the selected game. The one way back is the parent's
 * name: on the game's own menu (whose Back names the space's games) that is
 * the room; on any screen the game opens, the game. The list of games has
 * no way back inside the room: Minimize steps out of it.
 */
export function spaceTrail(input: SpaceTrailInput): SpaceTrail {
  if (input.place === undefined) return { room: 'current', place: null };
  if (!input.hasBack) return { room: 'ancestor', place: 'current' };
  if (input.backLabel !== undefined && input.backLabel !== input.place) {
    return { room: 'parent', place: 'current' };
  }
  return { room: 'ancestor', place: 'parent' };
}

/** The way back's name: the parent place's, else the screen's own label. */
export function spaceBackName(
  input: SpaceTrailInput & { readonly room: string }
): string | undefined {
  const trail = spaceTrail(input);
  if (trail.room === 'parent') return input.room;
  if (trail.place === 'parent') return input.place;
  return input.backLabel;
}
