import { customGamePositionAt } from '@libs/game-session-shared/custom-game-position';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import { createMemo, createSignal } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

export type CustomGameReview = ReturnType<typeof useCustomGameReview>;

export function useCustomGameReview(model: CustomGameScreenModel) {
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
      : (customGamePositionAt(chosen, displayedPly(), rules) ?? chosen.fen);
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
      customGamePositionAt(chosen, value, rules) === null
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
    live,
    displayedPly,
    selection,
    error,
    seek,
    select,
    returnLive: () => select('live'),
  };
}
