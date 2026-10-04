import {
  openMultiplayerChess,
  refreshMultiplayerConnection,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { partition, restoreNetwork } from '@libs/harness/actions';
import { partitionLoadBalancer } from '@libs/harness/server-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';

export async function disconnectMultiplayer(w: HarnessWorld, actor: string) {
  await w.s.apply(openMultiplayerChess, actor);
  w.memo.set(
    `multiplayer:offline-board:${actor}`,
    (await w.s.read(multiplayerView, actor)).game
  );
  await w.s.apply(partition, actor);
  await w.s.apply(partition, `${actor}:events`);
  await w.s.apply(partitionLoadBalancer, actor);
  await w.s.apply(refreshMultiplayerConnection, actor);
  await w.s.until(
    async (s) =>
      (await multiplayerText(s, actor, 'multiplayer-offline')) !== null
  );
}
export async function reconnectMultiplayer(w: HarnessWorld, actor: string) {
  await w.s.apply(restoreNetwork);
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (await multiplayerText(s, actor, 'multiplayer-offline')) === null
  );
}
