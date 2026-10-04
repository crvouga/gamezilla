import {
  changeAvailability,
  lockOwners,
} from '@pkgs/matchmaking-sql-shared/owner-repository';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import type { MultiplayerGame } from './game';

export class MultiplayerGameRepository {
  constructor(private readonly tx: SqlTx) {}

  async unfinishedCount(ownerId: string): Promise<number> {
    const rows = await this.tx.query(sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games
      WHERE (white_id = ${ownerId} OR black_id = ${ownerId}) AND outcome = 'ongoing' AND deleted_at IS NULL`);
    return rows.length;
  }

  async owned(
    gameId: string,
    ownerId: string,
    lockAt?: number
  ): Promise<MultiplayerGame> {
    let game = await this.readOwned(gameId, ownerId);
    if (lockAt !== undefined) {
      await lockOwners(
        this.tx,
        [game.white_id, game.black_id],
        new Date(lockAt).toISOString()
      );
      game = await this.readOwned(gameId, ownerId);
    }
    return game;
  }

  private async readOwned(
    gameId: string,
    ownerId: string
  ): Promise<MultiplayerGame> {
    const rows =
      await this.tx.query(sql<MultiplayerGame>`SELECT id, white_id, black_id, fen, pgn,
      revision, turn, outcome, reason FROM chess_multiplayer_games
      WHERE id = ${gameId} AND (white_id = ${ownerId} OR black_id = ${ownerId}) AND deleted_at IS NULL`);
    const game = rows[0];
    if (game === undefined)
      throw new MutationError(
        'CHESS_GAME_UNAVAILABLE',
        'No multiplayer game is available to you.'
      );
    return game;
  }

  async save(
    game: MultiplayerGame,
    nowMs: number,
    server: boolean
  ): Promise<void> {
    await this.tx.run(sql`UPDATE chess_multiplayer_games SET fen = ${game.fen}, pgn = ${game.pgn},
      revision = ${game.revision}, turn = ${game.turn}, outcome = ${game.outcome}, reason = ${game.reason},
      updated_at = ${new Date(nowMs).toISOString()} WHERE id = ${game.id}`);
    if (server && game.outcome !== 'ongoing') {
      for (const ownerId of [game.white_id, game.black_id])
        await changeAvailability(this.tx, { ownerId, available: true, nowMs });
    }
  }

  async repeated(
    ownerId: string,
    requestId: string,
    gameId: string,
    kind: string
  ): Promise<boolean> {
    const rows = await this.tx.query(sql<{ game_id: string; kind: string }>`
      SELECT game_id, kind FROM chess_multiplayer_commands WHERE owner_id = ${ownerId} AND request_id = ${requestId}`);
    const receipt = rows[0];
    if (receipt === undefined) return false;
    if (receipt.game_id !== gameId || receipt.kind !== kind)
      throw new MutationError(
        'CHESS_REQUEST_REUSED',
        'That request belongs to another multiplayer command.'
      );
    return true;
  }

  async remember(
    ownerId: string,
    requestId: string,
    gameId: string,
    kind: string
  ): Promise<void> {
    await this.tx.run(sql`INSERT INTO chess_multiplayer_commands (id, owner_id, request_id, game_id, kind)
      VALUES (${JSON.stringify([ownerId, requestId])}, ${ownerId}, ${requestId}, ${gameId}, ${kind})`);
  }
}
