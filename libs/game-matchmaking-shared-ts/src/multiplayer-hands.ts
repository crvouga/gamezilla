import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type {
  DealtHandsRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { MultiplayerGame } from './game-state';
import { multiplayerOwner, multiplayerSides } from './multiplayer-roster';

/**
 * Dealt hands in a matched game. The server deals as the game is created,
 * keeps the hidden state in a table nobody else reads, and keeps each side's
 * hand in a row only its owner's devices read, rewritten whenever an action
 * changes it. The game row itself, which watchers and opponents read, holds
 * neither.
 */

/** The game's dealt-hands rules, when its authority deals hands. */
export function multiplayerHandsRules(
  game: Pick<MultiplayerGame, 'fen'>,
  rules: TurnGames
): DealtHandsRules | undefined {
  return rules.forPosition(game.fen).hands;
}

/**
 * The draws an id minted by the server's injected id source gives: its 128
 * hexadecimal bits as four numbers in [0, 1), then repeated. A server-made
 * UUID is the authority's randomness here, never shown to a seat.
 */
export function drawsFromId(id: string): () => number {
  const hex = id
    .replace(/[^0-9a-f]/gi, '')
    .padEnd(32, '0')
    .slice(0, 32);
  const words = [0, 8, 16, 24].map(
    (at) => Number.parseInt(hex.slice(at, at + 8), 16) / 4_294_967_296
  );
  let next = 0;
  return () => words[next++ % words.length]!;
}

async function writeHands(
  tx: SqlTx,
  game: MultiplayerGame,
  change: { readonly hidden: string; readonly hands: DealtHandsRules },
  nowMs: number
): Promise<void> {
  const iso = new Date(nowMs).toISOString();
  for (const side of multiplayerSides(game)) {
    const hand = change.hands.hand(change.hidden, side);
    await tx.run(sql`INSERT INTO chess_multiplayer_hands
      (id, game_id, owner_id, side, hand, created_at, updated_at, deleted_at)
      VALUES (${JSON.stringify([game.id, side])}, ${game.id}, ${multiplayerOwner(game, side)}, ${side},
        ${hand}, ${iso}, ${iso}, ${null})
      ON CONFLICT (id) DO UPDATE SET hand = excluded.hand, updated_at = excluded.updated_at`);
  }
  await tx.run(sql`INSERT INTO chess_multiplayer_hidden
    (id, game_id, hidden, created_at, updated_at, deleted_at)
    VALUES (${game.id}, ${game.id}, ${change.hidden}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO UPDATE SET hidden = excluded.hidden, updated_at = excluded.updated_at`);
}

/** Deal a new matched game's hands, for a game whose authority deals them. */
export async function dealMultiplayerHands(
  tx: SqlTx,
  game: MultiplayerGame,
  ports: {
    readonly rules: TurnGames;
    readonly createId: (() => string) | undefined;
    readonly nowMs: number;
  }
): Promise<void> {
  const hands = multiplayerHandsRules(game, ports.rules);
  if (hands === undefined) return;
  if (ports.createId === undefined)
    throw new Error('dealing a matched game needs the server id source');
  const hidden = hands.deal(game.fen, drawsFromId(ports.createId()));
  await writeHands(tx, game, { hidden, hands }, ports.nowMs);
}

/** The matched game's hidden state, as only the server holds it. */
export async function readMultiplayerHidden(
  tx: SqlTx,
  gameId: string
): Promise<string | null> {
  const rows = await tx.query(sql<{ hidden: string }>`
    SELECT hidden FROM chess_multiplayer_hidden
    WHERE game_id = ${gameId} AND deleted_at IS NULL`);
  return rows[0]?.hidden ?? null;
}

/**
 * The public action `proposal` resolves to with the hidden state, and the
 * hidden state after it; a refusal is the game's own reason.
 */
export function resolveMultiplayerHand(
  game: MultiplayerGame,
  proposal: string,
  input: { readonly hidden: string | null; readonly hands: DealtHandsRules }
): { readonly action: string; readonly hidden: string } {
  if (input.hidden === null)
    throw new MutationError(
      'CHESS_HANDS_UNDEALT',
      'This game has not been dealt yet.'
    );
  const resolution = input.hands.resolve(game.fen, proposal, input.hidden);
  if ('refusal' in resolution)
    throw new MutationError(
      'CHESS_ILLEGAL_MOVE',
      'That multiplayer move is illegal.'
    );
  return resolution;
}

/** Record the hidden state and hands after an accepted action. */
export async function saveMultiplayerHands(
  tx: SqlTx,
  game: MultiplayerGame,
  change: {
    readonly hidden: string;
    readonly rules: TurnGames;
    readonly nowMs: number;
  }
): Promise<void> {
  const hands = multiplayerHandsRules(game, change.rules);
  if (hands !== undefined)
    await writeHands(tx, game, { hidden: change.hidden, hands }, change.nowMs);
}
