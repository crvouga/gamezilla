import { opponentRestrictions } from '@libs/friends-shared/opponent-restrictions';
import { assert } from '@pkgs/assert-root-shared/singleton';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type {
  FormedParticipant,
  MatchFormation,
} from '@pkgs/matchmaking-sql-shared/match-pass';
import { formMatches } from '@pkgs/matchmaking-sql-shared/match-pass';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { createMultiplayerGame } from './game-creation';
import { MultiplayerGameRepository } from './game-repository';
import {
  CHESS_SEARCH_RADIUS,
  CHESS_TIME_CONTROL_KEY,
  chessOpponentPool,
} from './search-config';
import { projectOpponentSearch } from './search-projection';
import { TIME_CONTROLS } from './time-control';

/**
 * Settles equal colour balances. Callers inject the chance: the formation
 * derives it from a freshly minted id; a fixture may fix it.
 */
export type ColourTieBreak = () => boolean;

/** An unbiased coin from an injected id source: true keeps the first person White. */
export function coinFromId(id: string): boolean {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (hash & 1) === 0;
}

function timeControlOf(fact: MatchFormation): string {
  const control = fact.participants[0]!.data[asKeyword(CHESS_TIME_CONTROL_KEY)];
  assert.ok(typeof control === 'string', 'a chess match has a time control');
  return control;
}

/** The person with the greater colour balance plays Black. */
async function colours(
  tx: SqlTx,
  people: readonly FormedParticipant[],
  tieBreak: ColourTieBreak
): Promise<readonly [string, string]> {
  const games = new MultiplayerGameRepository(tx);
  const [first, second] = [people[0]!.ownerId, people[1]!.ownerId];
  const a = await games.colourBalance(first);
  const b = await games.colourBalance(second);
  const firstIsWhite = a === b ? tieBreak() : a < b;
  return firstIsWhite ? [first, second] : [second, first];
}

/** Invoked inside the reusable package's formation transaction. */
export async function acceptChessMatch(
  tx: SqlTx,
  fact: MatchFormation,
  ports: { readonly nowMs: number; readonly tieBreak: ColourTieBreak }
): Promise<void> {
  assert.ok(fact.participants.length === 2, 'a chess match has two people');
  const prior = await tx.query(
    sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games WHERE match_id = ${fact.matchId}`
  );
  if (prior.length > 0) return;
  const games = new MultiplayerGameRepository(tx);
  for (const person of fact.participants)
    assert.ok(
      (await games.unfinishedCount(person.ownerId)) === 0,
      'an unfinished game makes its person unavailable'
    );
  const [whiteId, blackId] = await colours(
    tx,
    fact.participants,
    ports.tieBreak
  );
  await createMultiplayerGame(tx, {
    id: fact.matchId,
    whiteId,
    blackId,
    timeControl: timeControlOf(fact),
    rematchOf: null,
    nowMs: ports.nowMs,
  });
  for (const person of fact.participants)
    await projectOpponentSearch(tx, person.ownerId, ports.nowMs);
}

/** One formation pass per time control's pool; people meet only within one. */
export async function formChessMatches(
  tx: SqlTx,
  ports: {
    readonly nowMs: number;
    readonly createId: () => string;
    readonly tieBreak?: ColourTieBreak;
  }
): Promise<readonly string[]> {
  const owners: string[] = [];
  for (const control of TIME_CONTROLS)
    await formMatches(tx, {
      nowMs: ports.nowMs,
      createId: ports.createId,
      partitionSignature: chessOpponentPool(control.id),
      groupSize: 2,
      maxPairsPerPass: 500,
      radius: CHESS_SEARCH_RADIUS,
      restrictionsFor: opponentRestrictions,
      onFormed: async (transaction, fact) => {
        await acceptChessMatch(transaction, fact, {
          nowMs: ports.nowMs,
          tieBreak: ports.tieBreak ?? (() => coinFromId(ports.createId())),
        });
        owners.push(...fact.participants.map((person) => person.ownerId));
      },
    });
  return owners;
}
