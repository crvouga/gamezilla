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
import { multiplayerPeople } from './multiplayer-roster';
import { publishMatchGame } from './publish-match-game';
import { rateFinishedGame } from './rate-finished-game';
import { recordGameTransition } from './telemetry';

const COLUMNS = raw(MULTIPLAYER_GAME_COLUMNS.join(', '));

export type FormationPlayerState = {
  readonly unfinishedCount: number;
  readonly colourBalance: number;
};

export class MultiplayerGameRepository {
  constructor(private readonly tx: SqlTx) {}

  /** Eligibility and colour history for the complete, already-locked roster. */
  async formationState(
    ownerIds: readonly string[]
  ): Promise<ReadonlyMap<string, FormationPlayerState>> {
    const owners = [...new Set(ownerIds)];
    if (owners.length === 0) return new Map();
    const rows = await this.tx.query(sql<{
      white_id: string;
      black_id: string;
      red_id: string | null;
      blue_id: string | null;
      outcome: string;
    }>`SELECT white_id, black_id, red_id, blue_id, outcome FROM chess_multiplayer_games
      WHERE (white_id IN (${join(owners)}) OR black_id IN (${join(owners)})
        OR red_id IN (${join(owners)}) OR blue_id IN (${join(owners)}))
        AND outcome IN (${join(['ongoing', 'white', 'black', 'draw'])}) AND deleted_at IS NULL`);
    return new Map(
      owners.map((ownerId) => {
        const games = rows.filter((row) =>
          [row.white_id, row.black_id, row.red_id, row.blue_id].includes(
            ownerId
          )
        );
        return [
          ownerId,
          {
            unfinishedCount: games.filter((row) => row.outcome === 'ongoing')
              .length,
            colourBalance: games.reduce(
              (balance, row) =>
                balance +
                (row.outcome === 'ongoing'
                  ? 0
                  : row.white_id === ownerId
                    ? 1
                    : row.black_id === ownerId
                      ? -1
                      : 0),
              0
            ),
          },
        ];
      })
    );
  }

  async unfinishedCount(ownerId: string): Promise<number> {
    const rows = await this.tx.query(sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games
      WHERE (white_id = ${ownerId} OR black_id = ${ownerId} OR red_id = ${ownerId} OR blue_id = ${ownerId}) AND outcome = 'ongoing' AND deleted_at IS NULL`);
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
        multiplayerPeople(game),
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
      WHERE id = ${gameId} AND (white_id = ${ownerId} OR black_id = ${ownerId} OR red_id = ${ownerId} OR blue_id = ${ownerId}) AND deleted_at IS NULL`);
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
      red_ms = ${game.red_ms ?? null}, blue_ms = ${game.blue_ms ?? null},
      red_rating_diff = ${game.red_rating_diff ?? null}, blue_rating_diff = ${game.blue_rating_diff ?? null},
      draw_votes = ${game.draw_votes ?? null}, rematch_votes = ${game.rematch_votes ?? null},
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
      for (const ownerId of multiplayerPeople(game))
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
