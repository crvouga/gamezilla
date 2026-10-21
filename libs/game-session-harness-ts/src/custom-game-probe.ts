/**
 * The Custom Game screen's test hook: the room's custom-game state as the
 * person's device holds it, with what the screen adds (their side, the
 * position shown, the last refusal, the settled count). It is the
 * framework's own view of its stored state — never part of the game API;
 * a game's harness reads `custom-game-screen`.
 */
import type { CustomGames } from '@libs/game-session-shared-ts/custom-game-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

export type CustomGameProbe = CustomGames & {
  readonly myId: string;
  readonly mySide: 'white' | 'black' | null;
  /** A move made with no connection waits for it, showing no result. */
  readonly waiting: boolean;
  /**
   * For a game with private setups, the person's own as the screen shows
   * it: what their setup board holds, and the confirmed one their game
   * board draws; `null` for any other game.
   */
  readonly privateSetup: {
    readonly arranged: string;
    readonly own: string | null;
  } | null;
  /** People in the space who are away, each with since when (room time). */
  readonly away: Readonly<Record<string, number>>;
  readonly error: string;
  readonly connected: boolean;
  readonly settled: number;
  readonly displayFen: string;
  readonly reviewPly: number;
  readonly live: boolean;
  readonly gates: Readonly<Record<string, boolean>>;
  readonly receipt: {
    readonly request: string;
    readonly reason: string;
    readonly pending: boolean;
  };
};

export async function readCustomGameProbe(
  s: ProductHarness,
  actor: string
): Promise<CustomGameProbe | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  try {
    const raw = await ui.get('custom-game-debug').text();
    return raw === null || raw.trim() === ''
      ? null
      : (JSON.parse(raw.replace(/\u200b/g, '')) as CustomGameProbe);
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'ElementNotFoundError')
      return null;
    throw cause;
  }
}

/** What `actor` sees of the custom game: its state, board and any refusal. */
export async function customGameView(s: ProductHarness, actor: string) {
  const probe = await readCustomGameProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no custom game`);
  return probe;
}
