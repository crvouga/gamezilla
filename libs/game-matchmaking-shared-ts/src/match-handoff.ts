import { opponentRestrictions } from '@libs/friends-shared-ts/opponent-restrictions';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import type {
  FormedParticipant,
  MatchFormation,
} from '@pkgs/matchmaking-sql-shared-ts/match-pass';
import { formMatches } from '@pkgs/matchmaking-sql-shared-ts/match-pass';
import { waitingPartitions } from '@pkgs/matchmaking-sql-shared-ts/waiting-partitions';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  gameSides,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createMultiplayerGame } from './game-creation';
import {
  MultiplayerGameRepository,
  type MultiplayerOwnerFacts,
} from './game-repository';
import { offeredMatchChoices } from './match-choice';
import { multiplayerSeatOwners } from './multiplayer-roster';
import {
  OPPONENT_SEARCH_RADIUS,
  OPPONENT_TIME_CONTROL_KEY,
  opponentPoolSignature,
} from './search-config';
import { projectFormedOpponentSearches } from './search-projection';

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
  const control =
    fact.participants[0]!.data[asKeyword(OPPONENT_TIME_CONTROL_KEY)];
  assert.ok(typeof control === 'string', 'a game match has a time control');
  return control;
}

/** The person with the greater colour balance plays Black. */
function colours(
  people: readonly FormedParticipant[],
  players: ReadonlyMap<string, MultiplayerOwnerFacts>,
  tieBreak: ColourTieBreak
): readonly [string, string] {
  const [first, second] = [people[0]!.ownerId, people[1]!.ownerId];
  const a = players.get(first)!.colourBalance;
  const b = players.get(second)!.colourBalance;
  const firstIsWhite = a === b ? tieBreak() : a < b;
  return firstIsWhite ? [first, second] : [second, first];
}

/** Invoked inside the reusable package's formation transaction. */
export async function acceptGameMatch(
  tx: SqlTx,
  fact: MatchFormation,
  ports: {
    readonly nowMs: number;
    readonly tieBreak: ColourTieBreak;
    readonly createId?: () => string;
  },
  rules: TurnGames
): Promise<void> {
  const seats = gameSides(rules.forControl(timeControlOf(fact)));
  assert.ok(
    fact.participants.length === seats.length,
    'a game match fills every declared seat'
  );
  const prior = await tx.query(
    sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games WHERE match_id = ${fact.matchId}`
  );
  if (prior.length > 0) return;
  const games = new MultiplayerGameRepository(tx);
  const players = await games.matchmakingFacts(
    fact.participants.map((person) => person.ownerId)
  );
  for (const person of fact.participants)
    assert.ok(
      players.get(person.ownerId)?.unfinished === 0,
      'an unfinished game makes its person unavailable'
    );
  const owners = multiplayerSeatOwners(
    seats,
    seats.length === 2
      ? colours(fact.participants, players, ports.tieBreak)
      : fact.participants.map((person) => person.ownerId)
  );
  await createMultiplayerGame(
    tx,
    {
      id: fact.matchId,
      ...owners,
      timeControl: timeControlOf(fact),
      rematchOf: null,
      nowMs: ports.nowMs,
      ...(ports.createId === undefined ? {} : { createId: ports.createId }),
    },
    rules
  );
  await projectFormedOpponentSearches(tx, {
    participantIds: fact.participants.map((person) => person.id),
    matchId: fact.matchId,
    timeControl: timeControlOf(fact),
    nowMs: ports.nowMs,
  });
}

/**
 * One formation pass per time control's pool; people meet only within one.
 * A pass costs several statements and a deployment offers dozens of pools, so
 * only the pools that have someone waiting get one.
 */
export async function formGameMatches(
  tx: SqlTx,
  ports: {
    readonly nowMs: number;
    readonly createId: () => string;
    readonly tieBreak?: ColourTieBreak;
  },
  rules: TurnGames
): Promise<readonly string[]> {
  const owners: string[] = [];
  const sizes = [
    ...new Set(
      rules.games
        .filter((game) => game.capabilities.matchmaking !== undefined)
        .map((game) => gameSides(game.rules).length)
    ),
  ];
  const waiting = await waitingPartitions(tx, sizes);
  for (const control of offeredMatchChoices(rules)) {
    const signature = opponentPoolSignature(control.id, rules);
    if (!waiting.has(signature)) continue;
    await formMatches(tx, {
      nowMs: ports.nowMs,
      createId: ports.createId,
      partitionSignature: signature,
      groupSize: gameSides(rules.forControl(control.id)).length,
      maxPairsPerPass: 500,
      radius: OPPONENT_SEARCH_RADIUS,
      restrictionsFor: opponentRestrictions,
      onFormed: async (transaction, fact) => {
        await acceptGameMatch(
          transaction,
          fact,
          {
            nowMs: ports.nowMs,
            tieBreak: ports.tieBreak ?? (() => coinFromId(ports.createId())),
            createId: ports.createId,
          },
          rules
        );
        owners.push(...fact.participants.map((person) => person.ownerId));
      },
    });
  }
  return owners;
}
