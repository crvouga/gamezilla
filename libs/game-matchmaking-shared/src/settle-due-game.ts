import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { MultiplayerGameRepository } from './game-repository';
import { settleMultiplayerClock } from './multiplayer-clock';

/**
 * The scheduled sweep's half of a deadline: applies a missed first move or a
 * flag that fell due, whoever is online. Returns the people to notify.
 *
 * It takes both people's owner lock and reads the game again under it, as
 * every command does, so a move, resignation or agreement committed while
 * the sweep waited is what it settles from: a game that already ended is
 * left alone, rated and freed once by the transaction that ended it.
 */
export async function settleDueGame(
  tx: SqlTx,
  deadline: { gameId: string; nowMs: number; createId: () => string },
  rules: TurnGames
): Promise<readonly string[]> {
  const { gameId, nowMs, createId } = deadline;
  const repository = new MultiplayerGameRepository(tx);
  const found = await repository.byId(gameId);
  if (found === null) return [];
  const stored = await repository.owned(gameId, found.white_id, nowMs);
  const settled = settleMultiplayerClock(stored, nowMs, rules);
  if (settled === stored) return [];
  await repository.save(stored, settled, nowMs, {
    server: true,
    publish: { createId },
  });
  return [stored.white_id, stored.black_id];
}
