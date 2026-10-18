import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import type { HarnessWorld } from '@libs/harness/spec-world';

/** The board this device holds, kept as what it last knew once it is offline. */
export async function rememberOfflineBoard(w: HarnessWorld, actor: string) {
  const key = `multiplayer:offline-board:${actor}`;
  if (w.memo.has(key)) return;
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game === null) return;
  w.memo.set(key, game);
}
