import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** The level of the seat's bot, when the game's bots have levels. */
export function useBotLevel(props: {
  readonly model: CustomGameScreenModel;
  readonly side: CustomGameSide;
}): () => BotDifficulty | undefined {
  const rules = useTurnGames();
  return () => {
    const game = props.model.current();
    if (game === null) return undefined;
    const levels =
      rules.capability(rules.forPosition(game.fen).id, 'custom-games')?.bots
        .difficulties ?? [];
    return levels.length > 1 ? game.difficulty[props.side] : undefined;
  };
}
