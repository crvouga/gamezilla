/**
 * Where a space's back control says it goes. Framework-free so it
 * unit-tests bare.
 */

export type SpaceBackNameInput = {
  /** The selected game's name; `undefined` on the space's list of games. */
  readonly place: string | undefined;
  /** The screen registered a way back. */
  readonly hasBack: boolean;
  /** Where that way back goes, when the screen named it ("Games", "Chess"). */
  readonly backLabel: string | undefined;
  /** The space's name. */
  readonly room: string;
};

/**
 * The place back leads to, named once: from a game's own menu (whose Back
 * names the space's games) that is the space; from any screen the game
 * opens, the game; elsewhere the screen's own label. `undefined` when
 * nothing names it.
 */
export function spaceBackName(input: SpaceBackNameInput): string | undefined {
  if (input.place === undefined || !input.hasBack) return input.backLabel;
  if (input.backLabel !== undefined && input.backLabel !== input.place) {
    return input.room;
  }
  return input.place;
}
