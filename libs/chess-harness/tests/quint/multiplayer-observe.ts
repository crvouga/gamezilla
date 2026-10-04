import { multiplayerDeviceViews } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { PlayTrace } from './multiplayer-world';
import {
  PLAY_PEOPLE,
  PLAY_PLACES,
  playFacts,
  playPerson,
} from './multiplayer-world';

function resultOf(
  game: MultiplayerGame | null,
  sides: readonly string[]
): QuintValue {
  if (game === null) return variant('NoPlay');
  if (game.outcome === 'ongoing') return variant('OngoingPlay');
  if (game.outcome === 'draw') return variant('DrawnPlay');
  return variant(
    'WonPlay',
    sides[game.outcome === 'white' ? 0 : 1] ?? 'unknown'
  );
}

function boardOf(w: PlayTrace, game: MultiplayerGame | null) {
  const fact = [...playFacts(w)].find(
    ([, f]) => f.formation.matchId === game?.id
  );
  return {
    number: game === null ? 0 : (fact?.[0] ?? -1),
    moves: game?.revision ?? 0,
    turn: game?.outcome === 'ongoing' ? playPerson(w, game.turn) : 'nobody',
    outcome: resultOf(game, fact?.[1].sides ?? []),
  };
}

export async function observePlay(
  w: PlayTrace
): Promise<Record<string, QuintValue>> {
  const playNumber = new Map<QuintValue, QuintValue>();
  const moveCount = new Map<QuintValue, QuintValue>();
  const turn = new Map<QuintValue, QuintValue>();
  const playOutcome = new Map<QuintValue, QuintValue>();
  const lookingForOpponent = new Map<QuintValue, QuintValue>();
  const views = await w.quiet.read(
    multiplayerDeviceViews,
    PLAY_PEOPLE.flatMap((person) => [person, `${person}_computer`])
  );
  for (const person of PLAY_PEOPLE)
    for (const place of PLAY_PLACES) {
      const d = { person, place };
      const actor = place === 'phone' ? person : `${person}_computer`;
      const view = views.get(actor)!;
      const board = boardOf(w, view.game);
      playNumber.set(d, board.number);
      moveCount.set(d, board.moves);
      turn.set(d, board.turn);
      playOutcome.set(d, board.outcome);
      lookingForOpponent.set(d, view.search?.standing === 'waiting');
    }
  return { playNumber, moveCount, turn, playOutcome, lookingForOpponent };
}
