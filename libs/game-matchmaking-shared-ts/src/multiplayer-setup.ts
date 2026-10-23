import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type {
  GameSetups,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { MultiplayerGame, MultiplayerSide } from './game-state';
import { requireUnfinished, setupReadySides } from './game-state';
import { multiplayerSideOf, multiplayerSides } from './multiplayer-roster';

/**
 * Private setups in a matched game. Each person chooses theirs once, after
 * pairing and before the first move; the server keeps it in a table only
 * its owner reads, and the game itself shows only which sides are ready.
 * Once both are, the first side's first-move wait begins.
 */

/** The side `actorId` plays in `game`. */
function sideOf(game: MultiplayerGame, actorId: string): MultiplayerSide {
  const side = multiplayerSideOf(game, actorId);
  if (side === null)
    throw new MutationError(
      'CHESS_MATCHED_ONLY',
      'Only the matched people can choose a setup.'
    );
  return side;
}

/** The setup readiness a new game of `rules` starts with. */
export function initialSetupReady(
  rules: TurnGames,
  control: string
): string | null {
  return rules.forControl(control).setup === undefined ? null : '';
}

/**
 * The game once `actorId` has chosen `setup`, and the setup as the game
 * stores it. A setup, once chosen, never changes.
 */
export function chooseSetup(
  game: MultiplayerGame,
  input: {
    readonly actorId: string;
    readonly setup: string;
    readonly nowMs: number;
  },
  rules: TurnGames
): { readonly game: MultiplayerGame; readonly setup: string } {
  requireUnfinished(game);
  const setupRules = rules.forPosition(game.fen).setup;
  if (setupRules === undefined || game.setup_ready === null)
    throw new MutationError(
      'CHESS_NO_SETUP',
      'This game has no setup to choose.'
    );
  const side = sideOf(game, input.actorId);
  const ready = setupReadySides(game);
  if (ready.includes(side))
    throw new MutationError(
      'CHESS_SETUP_CHOSEN',
      'Your setup is already chosen.'
    );
  const accepted = setupRules.accept(input.setup);
  if (accepted === null)
    throw new MutationError(
      'CHESS_SETUP_INCOMPLETE',
      'That setup is not complete.'
    );
  const sides = multiplayerSides(game).filter(
    (s) => s === side || ready.includes(s)
  );
  return {
    setup: accepted,
    game: {
      ...game,
      setup_ready: sides.join(','),
      // Both ready: the first side's first-move wait starts now.
      clock_at_ms:
        sides.length === multiplayerSides(game).length
          ? input.nowMs
          : game.clock_at_ms,
    },
  };
}

export async function insertMultiplayerSetup(
  tx: SqlTx,
  row: {
    readonly game: MultiplayerGame;
    readonly actorId: string;
    readonly setup: string;
    readonly nowMs: number;
  }
): Promise<void> {
  const side = sideOf(row.game, row.actorId);
  const iso = new Date(row.nowMs).toISOString();
  await tx.run(sql`INSERT INTO chess_multiplayer_setups
    (id, game_id, owner_id, side, setup, created_at, updated_at, deleted_at)
    VALUES (${JSON.stringify([row.game.id, side])}, ${row.game.id}, ${row.actorId}, ${side},
      ${row.setup}, ${iso}, ${iso}, ${null})`);
}

/** Both sides' setups, as only the server holds them together; `null` until both exist. */
export async function readMultiplayerSetups(
  tx: SqlTx,
  gameId: string
): Promise<GameSetups | null> {
  const rows = await tx.query(sql<{ side: string; setup: string }>`
    SELECT side, setup FROM chess_multiplayer_setups
    WHERE game_id = ${gameId} AND deleted_at IS NULL`);
  const white = rows.find((row) => row.side === 'white')?.setup;
  const black = rows.find((row) => row.side === 'black')?.setup;
  const red = rows.find((row) => row.side === 'red')?.setup;
  const blue = rows.find((row) => row.side === 'blue')?.setup;
  return white === undefined || black === undefined
    ? null
    : {
        white,
        black,
        ...(red === undefined ? {} : { red }),
        ...(blue === undefined ? {} : { blue }),
      };
}
