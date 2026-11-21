import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

/** Opens the move list and the history from a played game's status line. */
const MOVE_LIST_OPENER = 'custom-game-commands';

/**
 * Look at the move list as a person does: while a game is played or over it
 * opens from the status line (the moves place lists every move itself), so
 * `look` runs with it open, and it closes again after.
 */
export async function withMoveList<T>(
  ui: Driver,
  look: () => Promise<T>
): Promise<T> {
  const opens =
    !(await ui.get('custom-game-record').isVisible()) &&
    (await ui.get(MOVE_LIST_OPENER).isVisible());
  if (opens) await ui.get(MOVE_LIST_OPENER).tap();
  try {
    return await look();
  } finally {
    if (opens) await ui.key('escape');
  }
}
