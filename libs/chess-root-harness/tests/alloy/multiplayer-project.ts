import type { storedMultiplayerSnapshot } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { Snapshot } from '@pkgs/alloy-shared/world';

type Stored = Awaited<ReturnType<typeof storedMultiplayerSnapshot>>;

const STATES = {
  ongoing: 'unfinished',
  draw: 'drawn',
  aborted: 'aborted',
  white: 'won',
  black: 'won',
} as const;

/** Only rename persisted identities; Alloy decides whether the world is legal. */
export function projectMultiplayer(rows: Stored, label: string): Snapshot {
  const games = rows.games;
  const matched = games.filter((g) => g.rematch_of === null);
  const people = [...new Set(games.flatMap((g) => [g.white_id, g.black_id]))];
  return {
    label,
    atoms: {
      PlayPerson: people,
      PlayGame: games.map((g) => g.id),
      MatchmakingMatch: matched.map((g) => `match:${g.match_id}`),
      PlayBoard: games.map((g) => `board:${g.id}`),
      TimeControl: [...new Set(games.map((g) => `time:${g.time_control}`))],
      UnfinishedPlay: ['unfinished'],
      WonGame: ['won'],
      DrawnGame: ['drawn'],
      AbortedGame: ['aborted'],
    },
    relations: {
      'PlayPerson.currentPlay': rows.current.map((p) => [
        p.owner_id,
        p.game_id,
      ]),
      'MatchmakingMatch.matchedPeople': matched.flatMap((g) => [
        [`match:${g.match_id}`, g.white_id],
        [`match:${g.match_id}`, g.black_id],
      ]),
      'PlayGame.fromMatch': matched.map((g) => [g.id, `match:${g.match_id}`]),
      'PlayGame.rematchOf': games.flatMap((g) =>
        g.rematch_of === null ? [] : [[g.id, g.rematch_of]]
      ),
      'PlayGame.timeControl': games.map((g) => [
        g.id,
        `time:${g.time_control}`,
      ]),
      'PlayGame.whiteSide': games.map((g) => [g.id, g.white_id]),
      'PlayGame.blackSide': games.map((g) => [g.id, g.black_id]),
      'PlayGame.playBoard': games.map((g) => [g.id, `board:${g.id}`]),
      'PlayGame.playState': games.map((g) => [g.id, STATES[g.outcome]]),
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
