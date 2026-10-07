import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import { MultiplayerGameRepository } from './game-repository';
import { settleMultiplayerClock } from './multiplayer-clock';

/**
 * The scheduled sweep's half of a deadline: applies a missed first move or a
 * flag that fell due, whoever is online. Returns the people to notify.
 */
export async function settleDueGame(
  tx: SqlTx,
  gameId: string,
  nowMs: number,
  createId: () => string
): Promise<readonly string[]> {
  const repository = new MultiplayerGameRepository(tx);
  const stored = await repository.byId(gameId);
  if (stored === null) return [];
  const settled = settleMultiplayerClock(stored, nowMs);
  if (settled === stored) return [];
  await repository.save(stored, settled, nowMs, {
    server: true,
    publish: { createId },
  });
  return [stored.white_id, stored.black_id];
}
