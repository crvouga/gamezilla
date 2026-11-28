import { gameSessionPositionAt } from '@libs/game-session-shared-ts/game-session-position';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createMemo, createSignal } from 'solid-js';
import type { GameSessionScreenModel } from './use-game-session-screen';

export type GameSessionReview = ReturnType<typeof useGameSessionReview>;

export function useGameSessionReview(model: GameSessionScreenModel) {
  const rules = useTurnGames();
  const [selection, setSelection] = createSignal('live');
  const [ply, setPly] = createSignal<number | null>(null);
  const [error, setError] = createSignal('');
  const game = createMemo(() =>
    selection() === 'live'
      ? model.current()
      : (model.games().history.find((g) => g.id === selection()) ??
        model.current())
  );
  const displayedPly = createMemo(() => ply() ?? game()?.moves.length ?? 0);
  const fen = createMemo(() => {
    const chosen = game();
    return chosen === null
      ? ''
      : (gameSessionPositionAt(chosen, displayedPly(), rules) ?? chosen.fen);
  });
  /** The move that reached the shown position; `null` at the start. */
  const lastAction = createMemo((): string | null => {
    const chosen = game();
    const shown = displayedPly();
    return chosen === null || shown === 0
      ? null
      : (chosen.moves[shown - 1]?.uci ?? null);
  });
  const live = createMemo(
    () =>
      selection() === 'live' &&
      (ply() === null || ply() === model.current()?.moves.length)
  );
  const seek = (value: number): void => {
    const chosen = game();
    if (
      chosen === null ||
      gameSessionPositionAt(chosen, value, rules) === null
    ) {
      setError('no such move');
      return;
    }
    setError('');
    setPly(value);
  };
  const select = (value: string): void => {
    setSelection(value);
    setPly(null);
    setError('');
  };
  return {
    game,
    fen,
    lastAction,
    live,
    displayedPly,
    selection,
    error,
    seek,
    select,
    returnLive: () => select('live'),
  };
}
