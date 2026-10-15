import type { GameSide } from '@pkgs/turn-game-shared/game-rules';
import { useGamePresentation } from './turn-games-context';
export function useGameSideLabel() {
  const presentation = useGamePresentation();
  return (position: string, side: GameSide): string =>
    presentation(position).sideLabel(side);
}
