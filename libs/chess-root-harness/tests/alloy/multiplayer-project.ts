import type { storedMultiplayerSnapshot } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { Snapshot } from '@pkgs/alloy-shared/world';

type Stored = Awaited<ReturnType<typeof storedMultiplayerSnapshot>>;

/** Only rename persisted identities; Alloy decides whether the world is legal. */
export function projectMultiplayer(rows: Stored, label: string): Snapshot {
  const games = rows.games;
  const people = [...new Set(games.flatMap((g) => [g.white_id, g.black_id]))];
  return {
    label,
    atoms: {
      PlayPerson: people,
      PlayGame: games.map((g) => g.id),
      MatchmakingMatch: games.map((g) => `match:${g.match_id}`),
      PlayBoard: games.map((g) => `board:${g.id}`),
      UnfinishedPlay: ['unfinished'],
      WonGame: ['won'],
      DrawnGame: ['drawn'],
    },
    relations: {
      'PlayPerson.currentPlay': rows.current.map((p) => [
        p.owner_id,
        p.game_id,
      ]),
      'MatchmakingMatch.matchedPeople': games.flatMap((g) => [
        [`match:${g.match_id}`, g.white_id],
        [`match:${g.match_id}`, g.black_id],
      ]),
      'PlayGame.fromMatch': games.map((g) => [g.id, `match:${g.match_id}`]),
      'PlayGame.whiteSide': games.map((g) => [g.id, g.white_id]),
      'PlayGame.blackSide': games.map((g) => [g.id, g.black_id]),
      'PlayGame.playBoard': games.map((g) => [g.id, `board:${g.id}`]),
      'PlayGame.playState': games.map((g) => [
        g.id,
        g.outcome === 'ongoing'
          ? 'unfinished'
          : g.outcome === 'draw'
            ? 'drawn'
            : 'won',
      ]),
      'PlayGame.winner': games.flatMap((g) =>
        g.outcome === 'white'
          ? [[g.id, g.white_id]]
          : g.outcome === 'black'
            ? [[g.id, g.black_id]]
            : []
      ),
    },
  };
}
