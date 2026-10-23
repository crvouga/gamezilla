import type { storedMultiplayerSnapshot } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import type { Snapshot } from '@pkgs/alloy-shared-ts/world';

type Stored = Awaited<ReturnType<typeof storedMultiplayerSnapshot>>;

const STATES = {
  ongoing: 'unfinished',
  draw: 'drawn',
  aborted: 'aborted',
  white: 'won',
  black: 'won',
} as const;

/**
 * Only rename persisted identities into `specs/games/matched-games.als`'s
 * atoms: the product's white and black are the first and second side.
 * Alloy decides whether the world is legal.
 */
export function projectMatchedGames(rows: Stored, label: string): Snapshot {
  const games = rows.games;
  const paired = games.filter((g) => g.rematch_of === null);
  const people = [...new Set(games.flatMap((g) => [g.white_id, g.black_id]))];
  return {
    label,
    atoms: {
      Person: people,
      PlayGame: games.map((g) => g.id),
      Pairing: paired.map((g) => `pairing:${g.match_id}`),
      PlayBoard: games.map((g) => `board:${g.id}`),
      ClockChoice: [...new Set(games.map((g) => `clock:${g.time_control}`))],
      UnfinishedPlay: ['unfinished'],
      WonGame: ['won'],
      DrawnGame: ['drawn'],
      AbortedGame: ['aborted'],
    },
    relations: {
      'Person.currentPlay': rows.current.map((p) => [p.owner_id, p.game_id]),
      'Pairing.pairedPeople': paired.flatMap((g) => [
        [`pairing:${g.match_id}`, g.white_id],
        [`pairing:${g.match_id}`, g.black_id],
      ]),
      'PlayGame.fromPairing': paired.map((g) => [
        g.id,
        `pairing:${g.match_id}`,
      ]),
      'PlayGame.rematchOf': games.flatMap((g) =>
        g.rematch_of === null ? [] : [[g.id, g.rematch_of]]
      ),
      'PlayGame.clockChoice': games.map((g) => [
        g.id,
        `clock:${g.time_control}`,
      ]),
      'PlayGame.firstSide': games.map((g) => [g.id, g.white_id]),
      'PlayGame.secondSide': games.map((g) => [g.id, g.black_id]),
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
