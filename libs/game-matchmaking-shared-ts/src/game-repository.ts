import {
  changeAvailability,
  lockOwners,
} from '@pkgs/matchmaking-sql-shared-ts/owner-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { join, raw } from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { MultiplayerGame } from './game-state';
import { MULTIPLAYER_GAME_COLUMNS } from './game-state';
import { stopMultiplayerClock } from './multiplayer-clock';
import { scheduleMultiplayerDeadline } from './multiplayer-deadline';
import { scheduleMultiplayerNotices } from './multiplayer-notices';
import { publishMatchGame } from './publish-match-game';
import { rateFinishedGame } from './rate-finished-game';
import { recordGameTransition } from './telemetry';

const COLUMNS = raw(MULTIPLAYER_GAME_COLUMNS.join(', '));

export type MultiplayerOwnerFacts = {
  readonly unfinished: number;
  readonly colourBalance: number;
};

export class MultiplayerGameRepository {
  constructor(private readonly tx: SqlTx) {}

  async unfinishedCount(ownerId: string): Promise<number> {
    const rows = await this.tx.query(sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games
      WHERE (white_id = ${ownerId} OR black_id = ${ownerId}) AND outcome = 'ongoing' AND deleted_at IS NULL`);
    return rows.length;
  }

  /** Read both candidate histories together while their owner locks are held. */
  async matchmakingFacts(
    ownerIds: readonly string[]
  ): Promise<ReadonlyMap<string, MultiplayerOwnerFacts>> {
    const facts = new Map(
      ownerIds.map((id) => [id, { unfinished: 0, colourBalance: 0 }])
    );
    if (facts.size === 0) return facts;
    const rows = await this.tx.query(sql<{
      white_id: string;
      black_id: string;
      outcome: string;
    }>`
      SELECT white_id, black_id, outcome FROM chess_multiplayer_games
      WHERE (white_id IN (${join(ownerIds)}) OR black_id IN (${join(ownerIds)})) AND deleted_at IS NULL`);
    for (const row of rows) {
      for (const [ownerId, fact] of facts) {
        if (row.white_id !== ownerId && row.black_id !== ownerId) continue;
        if (row.outcome === 'ongoing') fact.unfinished += 1;
        if (['white', 'black', 'draw'].includes(row.outcome))
          fact.colourBalance += row.white_id === ownerId ? 1 : -1;
      }
    }
    return facts;
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

  async byId(gameId: string): Promise<MultiplayerGame | null> {
    const rows = await this.tx.query(sql<MultiplayerGame>`SELECT ${COLUMNS}
      FROM chess_multiplayer_games WHERE id = ${gameId} AND deleted_at IS NULL`);
    return rows[0] ?? null;
  }

  private async readOwned(
    gameId: string,
    ownerId: string
  ): Promise<MultiplayerGame> {
    const rows = await this.tx.query(sql<MultiplayerGame>`SELECT ${COLUMNS}
      FROM chess_multiplayer_games
      WHERE id = ${gameId} AND (white_id = ${ownerId} OR black_id = ${ownerId}) AND deleted_at IS NULL`);
    const game = rows[0];
    if (game === undefined)
      throw new MutationError(
        'CHESS_GAME_UNAVAILABLE',
        'No multiplayer game is available to you.'
      );
    return game;
  }

  /**
   * Writes the game's new state. A game that just ended frees both people
   * for matchmaking, and a finished one moves both ratings for its speed
   * once; an unfinished one keeps a deadline for the scheduled sweep.
   */
  async save(
    before: MultiplayerGame,
    after: MultiplayerGame,
    nowMs: number,
    write: {
      readonly server: boolean;
      readonly publish?: {
        readonly createId: () => string;
        readonly synthetic?: boolean;
      };
    }
  ): Promise<MultiplayerGame> {
    const { server, publish } = write;
    const ended = before.outcome === 'ongoing' && after.outcome !== 'ongoing';
    const stopped = ended ? stopMultiplayerClock(before, after, nowMs) : after;
    const game =
      server && ended
        ? await rateFinishedGame(this.tx, stopped, nowMs)
        : stopped;
    await this.tx.run(sql`UPDATE chess_multiplayer_games SET fen = ${game.fen}, pgn = ${game.pgn},
      revision = ${game.revision}, turn = ${game.turn}, outcome = ${game.outcome}, reason = ${game.reason},
      white_ms = ${game.white_ms}, black_ms = ${game.black_ms}, clock_at_ms = ${game.clock_at_ms}, paused_at_ms = ${game.paused_at_ms},
      draw_offer_by = ${game.draw_offer_by}, rematch_offer_by = ${game.rematch_offer_by},
      white_rating_diff = ${game.white_rating_diff}, black_rating_diff = ${game.black_rating_diff},
      setup_ready = ${game.setup_ready}, updated_at = ${new Date(nowMs).toISOString()} WHERE id = ${game.id}`);
    if (server && publish !== undefined)
      await publishMatchGame(
        {
          tx: this.tx,
          env: { now: () => new Date(nowMs), createId: publish.createId },
        },
        game
      );
    if (!server) return game;
    await recordGameTransition(this.tx, {
      before,
      after: game,
      nowMs,
      ...(publish?.synthetic === undefined
        ? {}
        : { synthetic: publish.synthetic }),
    });
    if (ended)
      for (const ownerId of [game.white_id, game.black_id])
        await changeAvailability(this.tx, { ownerId, available: true, nowMs });
    await scheduleMultiplayerDeadline(this.tx, game, nowMs);
    await scheduleMultiplayerNotices(this.tx, { before, after: game }, nowMs);
    return game;
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
