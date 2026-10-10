import { actorUi, pollUntil } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

/**
 * Chess chrome, then a space that can no longer host it. An ended or missing
 * space also shows Back; that Back leaves the space and is not a way in.
 */
const ARRIVAL_IDS = [
  'game-menu-chess',
  'chess-menu-multiplayer',
  'multiplayer-game',
  'multiplayer-waiting',
  'multiplayer-find',
  'multiplayer-access-denial',
  'multiplayer-unavailable',
  Handles.spaceEnded,
  Handles.spaceNotFound,
  Handles.navBack,
] as const;

/** The first surface in `ARRIVAL_IDS` that is on screen. */
export function firstMultiplayerArrival(
  visible: ReadonlySet<string>
): string | null {
  for (const id of ARRIVAL_IDS) if (visible.has(id)) return id;
  return null;
}

/** An ended or missing space has no chess choices left to open. */
export function multiplayerArrivalIsTerminal(id: string): boolean {
  return id === Handles.spaceEnded || id === Handles.spaceNotFound;
}

/** Return from another chess activity through the space's own Back control. */
export async function reachMultiplayerChoices(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  for (let depth = 0; depth < 8; depth++) {
    const target = await pollUntil(
      s,
      async () => {
        const visible = new Set<string>();
        for (const id of ARRIVAL_IDS)
          if (await ui.get(id).isVisible()) visible.add(id);
        return firstMultiplayerArrival(visible);
      },
      { maxMs: 5000, description: 'the space chess choices' }
    );
    if (target !== Handles.navBack) return target;
    await ui.get(Handles.navBack).tap();
  }
  throw new Error('The space never returned to its chess choices');
}
