import { heldMatchedGame } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

/** The board this device holds, kept as what it last knew once it is offline. */
export async function rememberOfflineBoard(w: HarnessWorld, actor: string) {
  const key = `multiplayer:offline-board:${actor}`;
  if (w.memo.has(key)) return;
  const game = await w.s.read(heldMatchedGame, actor);
  if (game === null) return;
  w.memo.set(key, game);
}
