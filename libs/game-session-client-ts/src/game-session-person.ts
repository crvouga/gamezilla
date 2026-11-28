import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionScreenModel } from './use-game-session-screen';

/** The level of the seat's bot, when the game's bots have levels. */
export function useBotLevel(props: {
  readonly model: GameSessionScreenModel;
  readonly side: GameSessionSide;
}): () => BotDifficulty | undefined {
  const rules = useTurnGames();
  return () => {
    const game = props.model.current();
    if (game === null) return undefined;
    const levels =
      rules.capability(rules.forPosition(game.fen).id, 'vs-bot')?.bots
        .difficulties ?? [];
    return levels.length > 1 ? game.difficulty[props.side] : undefined;
  };
}
