import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { insertOutboxEvent } from '@pkgs/outbox-shared-ts/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import { GAME_PLATFORM_NAMESPACE } from './durable-names';
import type { MultiplayerGame } from './game-state';
import { multiplayerDeadlineMs } from './multiplayer-clock';

const messages = createMessageNamespace(GAME_PLATFORM_NAMESPACE, 'outbox');

/** A game may end by itself at this time: a missed first move or a flag. */
export const MultiplayerDeadline = messages(
  'multiplayer-deadline',
  (value: unknown): value is { readonly gameId: string } =>
    isPlainRecord(value) &&
    typeof value['gameId'] === 'string' &&
    value['gameId'].length > 0
);

/** The scheduled sweep settles the game at its deadline, whoever is online. */
export async function scheduleMultiplayerDeadline(
  tx: SqlTx,
  game: MultiplayerGame,
  nowMs: number
): Promise<void> {
  const deadline = multiplayerDeadlineMs(game);
  if (deadline === null) return;
  await insertOutboxEvent(tx, {
    id: `chess.multiplayer-deadline:${JSON.stringify([game.id, deadline])}`,
    message: MultiplayerDeadline({ gameId: game.id }),
    nowIso: new Date(nowMs).toISOString(),
    availableAt: new Date(deadline),
  });
}
